/**
 * AnkiConnect Android Client
 * Handles communication with AnkiConnect on localhost:8765
 */
const AnkiConnect = {
  // Config defaults stored in localStorage
  getConfig() {
    const storedDeck = localStorage.getItem('anki_deck');
    return {
      url: localStorage.getItem('anki_url') || 'http://localhost:8765',
      deck: storedDeck !== null ? storedDeck : 'Mining',
      pictureField: localStorage.getItem('anki_field') || 'Picture',
      autoAttach: localStorage.getItem('anki_auto_attach') === 'true',
      formatTemplate: localStorage.getItem('anki_format_template') || '<img src="{filename}">'
    };
  },

  saveConfig({ url, deck, pictureField, autoAttach, formatTemplate }) {
    if (url) localStorage.setItem('anki_url', url.trim());
    if (deck !== undefined && deck !== null) localStorage.setItem('anki_deck', deck.trim());
    if (pictureField) localStorage.setItem('anki_field', pictureField.trim());
    if (autoAttach !== undefined) localStorage.setItem('anki_auto_attach', autoAttach ? 'true' : 'false');
    if (formatTemplate !== undefined) localStorage.setItem('anki_format_template', formatTemplate.trim());
  },

  isSetupCompleted() {
    return localStorage.getItem('anki_setup_completed') === 'true';
  },

  setSetupCompleted(completed = true) {
    localStorage.setItem('anki_setup_completed', completed ? 'true' : 'false');
  },

  async invoke(action, params = {}, version = 6) {
    const config = this.getConfig();
    let response;
    try {
      response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, version, params })
      });
    } catch (err) {
      throw new Error(`Cannot connect to AnkiConnect at ${config.url}. Ensure AnkiConnect Android service is started.`);
    }

    if (!response.ok) {
      throw new Error(`AnkiConnect HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`AnkiConnect error: ${data.error}`);
    }

    return data.result;
  },

  /**
   * Check connection to AnkiConnect
   */
  async checkConnection() {
    return await this.invoke('version');
  },

  /**
   * Save media file (base64 image) to Anki's media collection
   * @param {string} base64Data Raw base64 data without data:image prefix
   * @param {string} filename Optional target filename
   * @returns {Promise<string>} Saved filename
   */
  async storeMediaFile(base64Data, filename = null) {
    if (!filename) {
      filename = `cardlens_${Date.now()}.jpg`;
    }
    // Clean base64 header if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9.+]+;base64,/, '').trim();

    await this.invoke('storeMediaFile', {
      filename: filename,
      data: cleanBase64
    });

    return filename;
  },

  /**
   * Get all recent note IDs in target deck (or all decks) added today
   * @returns {Promise<number[]>} Array of note IDs
   */
  async getRecentNoteIds() {
    const config = this.getConfig();
    let query = config.deck ? `deck:"${config.deck}" added:1` : 'added:1';
    let noteIds = await this.invoke('findNotes', { query });
    if (!noteIds || noteIds.length === 0) {
      if (config.deck) {
        noteIds = await this.invoke('findNotes', { query: 'added:1' });
      }
    }
    return noteIds || [];
  },

  /**
   * Find recent note in target deck
   * @returns {Promise<number>} Note ID
   */
  async findLatestNote() {
    const noteIds = await this.getRecentNoteIds();
    if (!noteIds || noteIds.length === 0) {
      throw new Error(`No recent Anki cards found. Create a card with Yomitan first, then tap Attach Image.`);
    }

    // Return the latest note ID (largest ID / last created)
    noteIds.sort((a, b) => b - a);
    return noteIds[0];
  },

  /**
   * Get note info
   */
  async getNoteInfo(noteId) {
    const notes = await this.invoke('notesInfo', { notes: [noteId] });
    if (!notes || notes.length === 0) {
      throw new Error(`Could not find note info for note ID ${noteId}`);
    }
    return notes[0];
  },

  /**
   * Attach image to a specific note ID
   * @param {number} noteId
   * @param {string} base64Data
   * @param {string|null} customTemplate
   * @returns {Promise<{ noteId: number, filename: string, noteName: string, fieldUsed: string }>}
   */
  async attachImageToNote(noteId, base64Data, customTemplate = null) {
    const config = this.getConfig();
    const noteInfo = await this.getNoteInfo(noteId);

    // Upload media file
    const filename = await this.storeMediaFile(base64Data);

    // Check target field
    const fieldName = config.pictureField;
    const currentFields = noteInfo.fields || {};

    let targetField = fieldName;
    if (!(targetField in currentFields)) {
      const candidate = Object.keys(currentFields).find(k => 
        /picture|image|photo|screenshot/i.test(k)
      );
      if (candidate) {
        targetField = candidate;
      } else {
        console.warn(`Field "${fieldName}" not in note fields:`, Object.keys(currentFields));
      }
    }

    // Render image tag using template
    const template = customTemplate || config.formatTemplate || '<img src="{filename}">';
    const imageTag = template.replace(/\{filename\}/g, filename);

    await this.invoke('updateNoteFields', {
      note: {
        id: noteId,
        fields: {
          [targetField]: imageTag
        }
      }
    });

    // Tag note with 'cardlens' for easy filtering and tracking
    try {
      await this.invoke('addTags', {
        notes: [noteId],
        tags: 'cardlens'
      });
    } catch (tagErr) {
      console.warn('Could not add cardlens tag to note:', tagErr);
    }

    const firstFieldValue = Object.values(currentFields)[0]?.value?.replace(/<[^>]+>/g, '').trim() || '';

    return {
      noteId,
      filename,
      noteName: firstFieldValue,
      fieldUsed: targetField
    };
  },

  /**
   * Attach image to the latest note
   * @param {string} base64Data Base64 string of the cropped image
   * @param {string|null} customTemplate Optional custom format template
   * @returns {Promise<{ noteId: number, filename: string, noteName: string, fieldUsed: string }>}
   */
  async attachImageToLatestNote(base64Data, customTemplate = null) {
    const noteId = await this.findLatestNote();
    return await this.attachImageToNote(noteId, base64Data, customTemplate);
  },

  /**
   * Get all deck names available in Anki
   * @returns {Promise<string[]>}
   */
  async getDeckNames() {
    return await this.invoke('deckNames');
  },

  /**
   * Get all note type (model) names available in Anki
   * @returns {Promise<string[]>}
   */
  async getModelNames() {
    return await this.invoke('modelNames');
  },

  /**
   * Get field names for a specific note type (model)
   * @param {string} modelName
   * @returns {Promise<string[]>}
   */
  async getModelFieldNames(modelName) {
    return await this.invoke('modelFieldNames', { modelName });
  },

  /**
   * Get card info for an array of card IDs
   * @param {number[]} cardIds
   * @returns {Promise<any[]>}
   */
  async getCardsInfo(cardIds) {
    return await this.invoke('cardsInfo', { cards: cardIds });
  },

  /**
   * Auto-detect deck, note type, and fields by inspecting the most recently added card in Anki
   * @returns {Promise<{ deckName: string, modelName: string, fields: string[], pictureField: string, noteId: number }>}
   */
  async detectFromRecentCard() {
    let noteIds = await this.invoke('findNotes', { query: 'added:30' });
    if (!noteIds || noteIds.length === 0) {
      noteIds = await this.invoke('findNotes', { query: 'added:365' });
    }
    if (!noteIds || noteIds.length === 0) {
      throw new Error('No recently added cards found in Anki. Create a card with Yomitan first or select fields manually.');
    }

    noteIds.sort((a, b) => b - a);
    const latestNoteId = noteIds[0];
    const noteInfo = await this.getNoteInfo(latestNoteId);

    const modelName = noteInfo.modelName;
    const fields = Object.keys(noteInfo.fields || {});

    let deckName = '';
    if (noteInfo.cards && noteInfo.cards.length > 0) {
      try {
        const cards = await this.getCardsInfo([noteInfo.cards[0]]);
        if (cards && cards.length > 0 && cards[0].deckName) {
          deckName = cards[0].deckName;
        }
      } catch (e) {
        console.warn('Could not query cardsInfo for deckName:', e);
      }
    }

    let pictureField = 'Picture';
    const candidate = fields.find(k => /^(picture|image|screenshot|photo)$/i.test(k))
      || fields.find(k => /picture|image|photo|screenshot/i.test(k));
    if (candidate) {
      pictureField = candidate;
    }

    return {
      noteId: latestNoteId,
      deckName,
      modelName,
      fields,
      pictureField
    };
  },

  /**
   * Parse exported Yomitan settings JSON (handles both flat dotted and nested JSON structures)
   * @param {string|object} jsonInput JSON string or parsed object
   * @returns {{ server: string, deck: string, model: string, pictureField: string, allFields: string[] }}
   */
  parseYomitanSettings(jsonInput) {
    let data;
    if (typeof jsonInput === 'string') {
      try {
        data = JSON.parse(jsonInput);
      } catch (err) {
        throw new Error('Invalid JSON file. Please provide a valid Yomitan export file.');
      }
    } else {
      data = jsonInput;
    }

    const getVal = (path) => {
      if (!data || typeof data !== 'object') return undefined;
      if (data[path] !== undefined) return data[path];
      const parts = path.split('.');
      let curr = data;
      for (const p of parts) {
        if (curr && typeof curr === 'object' && p in curr) {
          curr = curr[p];
        } else {
          return undefined;
        }
      }
      return curr;
    };

    const server = getVal('anki.server') || 'http://localhost:8765';
    const deck = getVal('anki.terms.deck') || '';
    const model = getVal('anki.terms.model') || '';
    const fields = getVal('anki.terms.fields') || {};

    let pictureField = null;
    for (const [fieldName, template] of Object.entries(fields)) {
      if (typeof template === 'string' && /\{(?:clipboard-)?(?:image|screenshot|picture)\}/i.test(template)) {
        pictureField = fieldName;
        break;
      }
    }

    if (!pictureField) {
      for (const fieldName of Object.keys(fields)) {
        if (/^(picture|image|screenshot|photo)$/i.test(fieldName)) {
          pictureField = fieldName;
          break;
        }
      }
    }

    if (!pictureField) {
      for (const fieldName of Object.keys(fields)) {
        if (/picture|image|screenshot|photo/i.test(fieldName)) {
          pictureField = fieldName;
          break;
        }
      }
    }

    return {
      server,
      deck,
      model,
      pictureField: pictureField || 'Picture',
      allFields: Object.keys(fields)
    };
  }
};

window.AnkiConnect = AnkiConnect;
