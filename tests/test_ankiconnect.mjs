import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (key) => (key in storage ? storage[key] : null),
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; }
};

// Mock window
global.window = global;

// Mock fetch
let mockAnkiResponses = {};
global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const action = body.action;

  if (mockAnkiResponses[action] instanceof Error) {
    throw mockAnkiResponses[action];
  }

  const handler = mockAnkiResponses[action];
  if (!handler) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: `Unknown action: ${action}` })
    };
  }

  const result = typeof handler === 'function' ? handler(body.params) : handler;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => result
  };
};

// Load ankiconnect.js into VM context
const code = fs.readFileSync('frontend/ankiconnect.js', 'utf-8');
vm.runInThisContext(code);

async function runTests() {
  console.log('Running AnkiConnect JS tests...');

  // Test 1: Config defaults & saving
  const config = window.AnkiConnect.getConfig();
  assert.strictEqual(config.url, 'http://localhost:8765');
  assert.strictEqual(config.deck, 'Mining');
  assert.strictEqual(config.pictureField, 'Picture');

  window.AnkiConnect.saveConfig({ deck: 'Japanese', pictureField: 'Image' });
  const updatedConfig = window.AnkiConnect.getConfig();
  assert.strictEqual(updatedConfig.deck, 'Japanese');
  assert.strictEqual(updatedConfig.pictureField, 'Image');

  // Test 2: Version Check (Milestone 6.1)
  mockAnkiResponses['version'] = { result: 6, error: null };
  const version = await window.AnkiConnect.checkConnection();
  assert.strictEqual(version, 6);
  console.log('✔ Test 2.1: Version check passed');

  // Test 3: storeMediaFile (Milestone 6.2)
  let storedParams = null;
  mockAnkiResponses['storeMediaFile'] = (params) => {
    storedParams = params;
    return { result: params.filename, error: null };
  };
  const savedFilename = await window.AnkiConnect.storeMediaFile('data:image/jpeg;base64,QUJDRA==', 'test_crop.jpg');
  assert.strictEqual(savedFilename, 'test_crop.jpg');
  assert.strictEqual(storedParams.data, 'QUJDRA==');
  assert.strictEqual(storedParams.filename, 'test_crop.jpg');
  console.log('✔ Test 2.2: storeMediaFile passed');

  // Test 4: findNotes (Milestone 6.3)
  mockAnkiResponses['findNotes'] = (params) => {
    if (params.query.includes('deck:"Japanese"')) {
      return { result: [1001, 1002], error: null };
    }
    return { result: [], error: null };
  };
  const latestNoteId = await window.AnkiConnect.findLatestNote();
  assert.strictEqual(latestNoteId, 1002);
  console.log('✔ Test 2.3: findLatestNote passed');

  // Test 5: End-to-end attachImageToLatestNote (Milestone 6.4 & 6.5)
  let updatedFields = null;
  mockAnkiResponses['notesInfo'] = (params) => {
    return {
      result: [
        {
          noteId: 1002,
          fields: {
            Expression: { value: '冒険' },
            Image: { value: '' }
          }
        }
      ],
      error: null
    };
  };

  mockAnkiResponses['updateNoteFields'] = (params) => {
    updatedFields = params.note.fields;
    return { result: null, error: null };
  };

  const attachResult = await window.AnkiConnect.attachImageToLatestNote('data:image/jpeg;base64,QUJD');
  assert.strictEqual(attachResult.noteId, 1002);
  assert.strictEqual(attachResult.noteName, '冒険');
  assert.strictEqual(attachResult.fieldUsed, 'Image');
  assert.ok(updatedFields.Image.includes('<img src="cardlens_'));
  console.log('✔ Test 2.4: attachImageToLatestNote passed');

  // Test 6: AnkiConnect offline handling (Milestone 6.6)
  mockAnkiResponses['version'] = new Error('Network error');
  await assert.rejects(
    async () => { await window.AnkiConnect.checkConnection(); },
    /Cannot connect to AnkiConnect/
  );
  console.log('✔ Test 2.5: Error when AnkiConnect offline handled gracefully');

  // Test 7: Yomitan Settings JSON Parsing (Flat & Nested)
  const yomitanFlat = JSON.stringify({
    'anki.server': 'http://localhost:8765',
    'anki.terms.deck': 'Japanese Mining',
    'anki.terms.model': 'Kaishi 1.5k',
    'anki.terms.fields': {
      'Word': '{expression}',
      'Reading': '{reading}',
      'Screenshot': '{clipboard-image}'
    }
  });
  const parsedFlat = window.AnkiConnect.parseYomitanSettings(yomitanFlat);
  assert.strictEqual(parsedFlat.deck, 'Japanese Mining');
  assert.strictEqual(parsedFlat.model, 'Kaishi 1.5k');
  assert.strictEqual(parsedFlat.pictureField, 'Screenshot');
  console.log('✔ Test 2.6: Yomitan flat JSON parsed correctly');

  const yomitanNested = JSON.stringify({
    anki: {
      server: 'http://127.0.0.1:8765',
      terms: {
        deck: 'Animecards Deck',
        model: 'Animecards',
        fields: {
          'Expression': '{expression}',
          'Picture': ''
        }
      }
    }
  });
  const parsedNested = window.AnkiConnect.parseYomitanSettings(yomitanNested);
  assert.strictEqual(parsedNested.deck, 'Animecards Deck');
  assert.strictEqual(parsedNested.model, 'Animecards');
  assert.strictEqual(parsedNested.pictureField, 'Picture');
  console.log('✔ Test 2.7: Yomitan nested JSON parsed correctly');

  // Test 8: Live Anki Discovery methods
  mockAnkiResponses['deckNames'] = { result: ['Default', 'Mining', 'Japanese'], error: null };
  const decks = await window.AnkiConnect.getDeckNames();
  assert.deepStrictEqual(decks, ['Default', 'Mining', 'Japanese']);

  mockAnkiResponses['modelNames'] = { result: ['Basic', 'Animecards'], error: null };
  const models = await window.AnkiConnect.getModelNames();
  assert.deepStrictEqual(models, ['Basic', 'Animecards']);

  mockAnkiResponses['modelFieldNames'] = (params) => ({
    result: ['Expression', 'Meaning', 'Picture'],
    error: null
  });
  const fields = await window.AnkiConnect.getModelFieldNames('Animecards');
  assert.deepStrictEqual(fields, ['Expression', 'Meaning', 'Picture']);
  console.log('✔ Test 2.8: Anki discovery methods (deckNames, modelNames, modelFieldNames) passed');

  // Test 9: detectFromRecentCard
  mockAnkiResponses['findNotes'] = (params) => ({ result: [2001], error: null });
  mockAnkiResponses['notesInfo'] = (params) => ({
    result: [{
      noteId: 2001,
      modelName: 'Kaishi 1.5k',
      cards: [9999],
      fields: {
        'Word': { value: 'テスト' },
        'Image': { value: '' }
      }
    }],
    error: null
  });
  mockAnkiResponses['cardsInfo'] = (params) => ({
    result: [{ cardId: 9999, deckName: 'Target Mining Deck' }],
    error: null
  });

  const detected = await window.AnkiConnect.detectFromRecentCard();
  assert.strictEqual(detected.deckName, 'Target Mining Deck');
  assert.strictEqual(detected.modelName, 'Kaishi 1.5k');
  assert.strictEqual(detected.pictureField, 'Image');
  console.log('✔ Test 2.9: detectFromRecentCard correctly detected deck, model, and picture field');

  // Test 10: Empty deck configuration retention & getRecentNoteIds
  window.AnkiConnect.saveConfig({ deck: '' });
  const emptyDeckConfig = window.AnkiConnect.getConfig();
  assert.strictEqual(emptyDeckConfig.deck, '');

  mockAnkiResponses['findNotes'] = (params) => {
    if (params.query === 'added:1') {
      return { result: [3001, 3002, 3003], error: null };
    }
    return { result: [], error: null };
  };
  const noteIds = await window.AnkiConnect.getRecentNoteIds();
  assert.deepStrictEqual(noteIds, [3001, 3002, 3003]);
  console.log('✔ Test 2.10: Empty deck handling and getRecentNoteIds snapshot passed');

  // Test 11: attachImageToNote directly with custom format template
  let directUpdatedFields = null;
  mockAnkiResponses['notesInfo'] = (params) => ({
    result: [{
      noteId: 3003,
      fields: {
        Expression: { value: '走る' },
        Picture: { value: '' }
      }
    }],
    error: null
  });
  mockAnkiResponses['updateNoteFields'] = (params) => {
    directUpdatedFields = params.note.fields;
    return { result: null, error: null };
  };

  const customTemplate = '<div class="card-screenshot"><img src="{filename}" loading="lazy"></div>';
  const directAttach = await window.AnkiConnect.attachImageToNote(3003, 'data:image/jpeg;base64,QUJD', customTemplate);
  assert.strictEqual(directAttach.noteId, 3003);
  assert.strictEqual(directAttach.noteName, '走る');
  assert.strictEqual(directAttach.fieldUsed, 'Picture');
  assert.ok(directUpdatedFields.Picture.startsWith('<div class="card-screenshot"><img src="cardlens_'));
  assert.ok(directUpdatedFields.Picture.endsWith('" loading="lazy"></div>'));
  console.log('✔ Test 2.11: attachImageToNote with custom template passed');

  console.log('\nAll AnkiConnect unit tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
