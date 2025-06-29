// js/modal.js
// Handles opening, closing, and specific modal logic.

import { state } from './state.js';
import * as ui from './ui.js';
import * as wordManager from './wordManager.js'; // Needed for word list editor save/state
import * as storage from './storage.js'; // Needed for saving favorites changes

// --- Generic Modal Controls ---
export function openModal(modalElement) {
    if(modalElement) modalElement.style.display = 'block';
}

export function closeModal(modalElement) {
    if(modalElement) {
        modalElement.style.display = 'none';

        // Specific cleanup when closing certain modals
        if (modalElement === ui.elements.rhymeFinderModal) {
            clearRhymeModal();
        }
        if (modalElement === ui.elements.favoritesModal) {
            clearFavoritesListDisplay(); // Avoid showing old list briefly
        }
        if (modalElement === ui.elements.settingsModal) {
            // No specific cleanup needed for settings modal
        }
        // No specific cleanup needed for word list editor on close
    }
}

// --- Favorites Modal ---
export function showFavoritesModal() {
    if(!ui.elements.favoritesModal || !ui.elements.favoritesListUl) return;

    clearFavoritesListDisplay(); // Clear first
    const sortedFavorites = Array.from(state.favorites).sort((a, b) => a.localeCompare(b)); // Sort alphabetically

    if (sortedFavorites.length === 0) {
         ui.elements.favoritesListUl.innerHTML = '<li>No favorited words yet.</li>';
    } else {
        sortedFavorites.forEach(word => {
            const li = document.createElement('li');
            li.textContent = word;
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.title="Remove Favorite";
            removeBtn.classList.add("icon-button", "tiny-button", "red-button");
            // Attach listener to internal handler
            removeBtn.onclick = () => handleRemoveFavorite(word);
            li.appendChild(removeBtn);
            ui.elements.favoritesListUl.appendChild(li);
        });
    }
    openModal(ui.elements.favoritesModal);
}

// Internal handler for removing a favorite
function handleRemoveFavorite(word) {
    const removingCurrent = (word === state.currentWord);
    state.favorites.delete(word);
    storage.saveSettings(); // Save the change
    showFavoritesModal(); // Refresh the modal list itself
    // Update main favorite icon if the current word was the one removed
    if(removingCurrent && ui.elements.favoriteButton) {
        ui.elements.favoriteButton.classList.remove('active');
    }
    ui.showFeedback(`"${word}" un-favorited.`);
}

export function clearAllFavorites() {
    if (state.favorites.size === 0) {
        ui.showFeedback("No favorites to clear.", true, 1500);
        return;
    }
    if (confirm('Are you sure you want to remove ALL favorited words?')) {
        const currentWordWasFav = state.favorites.has(state.currentWord);
        state.favorites.clear();
        storage.saveSettings(); // Save the change
        showFavoritesModal(); // Refresh modal list (will show empty)
        if(currentWordWasFav && ui.elements.favoriteButton) {
            ui.elements.favoriteButton.classList.remove('active');
        }
        ui.showFeedback("All favorites cleared!", false, 1500);
    }
}

// Internal helper to clear list display
function clearFavoritesListDisplay() {
    if (ui.elements.favoritesListUl) {
        ui.elements.favoritesListUl.innerHTML = '';
    }
}


// --- Word List Editor Modal ---
export function showWordListEditor() {
    if (!ui.elements.wordListEditorModal || !ui.elements.wordListTextarea) return;

    // Populate with current full word list from state
    ui.elements.wordListTextarea.value = state.wordList.join('\n');

    // Try scrolling to current word
    const wordToFind = state.currentWord; // Use state directly
    if (wordToFind && wordToFind !== "NO WORDS!") {
        const lines = ui.elements.wordListTextarea.value.split('\n');
        // Find first exact match (case sensitive)
        const lineIndex = lines.findIndex(line => line === wordToFind);

        if (lineIndex !== -1) {
             setTimeout(() => { // Allow modal to render & calculate heights
                  try {
                      const textarea = ui.elements.wordListTextarea;
                      // Basic calculation - might not be perfect with wrapping
                      const lineHeight = textarea.scrollHeight / Math.max(1, lines.length);
                      const targetScrollTop = Math.max(0, lineIndex * lineHeight - (textarea.clientHeight / 3));
                      textarea.scrollTop = targetScrollTop;
                  } catch (e) { console.warn("Error calculating scroll for editor:", e); }
             }, 100);
         } else {
              ui.elements.wordListTextarea.scrollTop = 0; // Scroll top if not found
         }
    } else {
         ui.elements.wordListTextarea.scrollTop = 0; // Scroll top if no current word
    }

    openModal(ui.elements.wordListEditorModal);
}

// Handles clicking the "Save" button in the word list editor
export function saveWordListChanges() {
    if (!ui.elements.wordListTextarea) return;
    
    // Get the current text from the textarea and process it
    const newText = ui.elements.wordListTextarea.value;
    
    // Call the logic in wordManager to update the list and state
    const success = wordManager.applyWordListChanges(newText);
    if (success) {
        // Save to localStorage for persistence - this ensures the edited word list
        // is permanently stored and will be loaded on future sessions
        storage.saveSettings();
        
        // Update any open modals that display data (like settings modal)
        updateDataSummary();
        
        // Close modal only if changes were successfully applied
        closeModal(ui.elements.wordListEditorModal);
        
        // Provide clear feedback about what was saved
        const wordCount = state.wordList.length;
        ui.showFeedback(`Word list saved! ${wordCount} words now in your list.`, false, 3000);
    }
    // If success is false, feedback is already handled within applyWordListChanges
}

// NEW: Add a new word to the list
export function addNewWord() {
    if (!ui.elements.wordListTextarea) return;
    
    const newWord = prompt("Enter a new word to add to the list:");
    if (!newWord || newWord.trim().length < 2) {
        ui.showFeedback("Word must be at least 2 characters long.", true, 2000);
        return;
    }
    
    const trimmedWord = newWord.trim();
    const currentWords = ui.elements.wordListTextarea.value.split('\n').map(w => w.trim()).filter(w => w);
    
    // Check if word already exists
    if (currentWords.includes(trimmedWord)) {
        ui.showFeedback(`"${trimmedWord}" is already in the list.`, true, 2000);
        return;
    }
    
    // Add the new word to the textarea
    const newText = currentWords.length > 0 ? 
        ui.elements.wordListTextarea.value + '\n' + trimmedWord :
        trimmedWord;
    
    ui.elements.wordListTextarea.value = newText;
    
    // Scroll to the new word
    setTimeout(() => {
        ui.elements.wordListTextarea.scrollTop = ui.elements.wordListTextarea.scrollHeight;
    }, 100);
    
    ui.showFeedback(`"${trimmedWord}" added to the list.`, false, 2000);
}

// NEW: Reset word list to default
export function resetWordList() {
    if (confirm('Are you sure you want to reset the word list to defaults? This will remove all custom words.')) {
        // Reset to default word list
        state.wordList = [...state.DEFAULT_WORD_LIST];
        
        // Update the textarea
        if (ui.elements.wordListTextarea) {
            ui.elements.wordListTextarea.value = state.wordList.join('\n');
        }
        
        // Reapply filters and update display
        wordManager.applyFiltersAndSort();
        wordManager.changeWord('next', true, false);
        
        // Save the reset
        storage.saveSettings();
        
        ui.showFeedback("Word list reset to defaults.", false, 3000);
    }
}

// NEW: Export word list only
export function exportWordList() {
    try {
        // Create comprehensive backup object with all word-related data
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            description: 'BaseFlowArena Word List Backup',
            data: {
                masterList: state.wordList, // The main word list (as modified by edits)
                blacklist: Array.from(state.blacklist), // Convert Set to Array for JSON serialization
                favorites: Array.from(state.favorites) // Convert Set to Array for JSON serialization
            }
        };
        
        // Use File System Access API for modern browsers
        if ('showSaveFilePicker' in window) {
            exportWithFileSystemAPI(backupData);
        } else {
            // Fallback for older browsers using the download method
            exportWithDownloadFallback(backupData);
        }
        
    } catch (e) {
        console.error("Error exporting word list:", e);
        ui.showFeedback("Error exporting word list!", true, 2000);
    }
}

// Helper function to export using File System Access API
async function exportWithFileSystemAPI(backupData) {
    try {
        // Create file picker options
        const options = {
            suggestedName: `flow-arena-backup-${new Date().toISOString().split('T')[0]}.json`,
            types: [{
                description: 'JSON Files',
                accept: {
                    'application/json': ['.json']
                }
            }]
        };
        
        // Show save file picker
        const fileHandle = await window.showSaveFilePicker(options);
        
        // Create writable stream and write data
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(backupData, null, 2));
        await writable.close();
        
        ui.showFeedback("Word list exported successfully!", false, 2000);
        
    } catch (error) {
        console.error("File System API error:", error);
        // Fallback to download method if user cancels or API fails
        exportWithDownloadFallback(backupData);
    }
}

// Fallback export method using download
function exportWithDownloadFallback(backupData) {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-arena-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ui.showFeedback("Word list exported successfully!", false, 2000);
}

// NEW: Import word list only
export function importWordList() {
    // Use File System Access API for modern browsers
    if ('showOpenFilePicker' in window) {
        importWithFileSystemAPI();
    } else {
        // Fallback for older browsers using file input
        importWithFileInputFallback();
    }
}

// Helper function to import using File System Access API
async function importWithFileSystemAPI() {
    try {
        // Create file picker options
        const options = {
            types: [{
                description: 'JSON Files',
                accept: {
                    'application/json': ['.json']
                }
            }],
            multiple: false // Only allow single file selection
        };
        
        // Show open file picker
        const [fileHandle] = await window.showOpenFilePicker(options);
        const file = await fileHandle.getFile();
        
        // Read and process the file
        await processImportedFile(file);
        
    } catch (error) {
        console.error("File System API import error:", error);
        if (error.name !== 'AbortError') { // Don't show error if user cancels
            ui.showFeedback("Error importing file!", true, 2000);
        }
    }
}

// Fallback import method using file input
function importWithFileInputFallback() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            await processImportedFile(file);
        }
    };
    input.click();
}

// Common function to process imported file data
async function processImportedFile(file) {
    try {
        // Read file content
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        // Validate the imported data structure
        if (!validateBackupData(importedData)) {
            throw new Error("Invalid backup file format. Please use a valid BaseFlowArena backup file.");
        }
        
        // Convert legacy formats to new format if necessary
        const normalizedData = convertLegacyFormat(importedData);
        
        // Extract data from the normalized structure
        const { masterList, blacklist = [], favorites = [] } = normalizedData.data;
        
        // Validate that masterList is an array and has content
        if (!Array.isArray(masterList) || masterList.length === 0) {
            throw new Error("Invalid word list in backup file.");
        }
        
        // Filter and validate words (remove empty strings, ensure minimum length)
        const validWords = masterList.filter(word => 
            word && typeof word === 'string' && word.trim().length >= 2
        ).map(word => word.trim());
        
        if (validWords.length === 0) {
            throw new Error("No valid words found in the imported file.");
        }
        
        // Validate blacklist and favorites arrays
        const validBlacklist = Array.isArray(blacklist) ? blacklist.filter(word => word && typeof word === 'string') : [];
        const validFavorites = Array.isArray(favorites) ? favorites.filter(word => word && typeof word === 'string') : [];
        
        // Confirm import with user (show what will be imported)
        const confirmMessage = `Import ${validWords.length} words, ${validBlacklist.length} blacklisted words, and ${validFavorites.length} favorites?`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Apply the imported data to the application state
        // Replace the master word list
        state.wordList = validWords;
        
        // Replace blacklist (convert array back to Set)
        state.blacklist = new Set(validBlacklist);
        
        // Replace favorites (convert array back to Set)
        state.favorites = new Set(validFavorites);
        
        // Update the word list editor textarea if it's open
        if (ui.elements.wordListTextarea) {
            ui.elements.wordListTextarea.value = state.wordList.join('\n');
        }
        
        // Reapply filters and update the application state
        wordManager.applyFiltersAndSort();
        
        // Get a new word to display (since the list has changed)
        wordManager.changeWord('next', true, false);
        
        // Save the imported state to localStorage
        storage.saveSettings();
        
        // Update any open modals that display data
        updateDataSummary();
        
        ui.showFeedback(`Successfully imported ${validWords.length} words!`, false, 3000);
        
    } catch (error) {
        console.error("Error processing imported file:", error);
        ui.showFeedback(`Import failed: ${error.message}`, true, 4000);
    }
}

// Helper function to validate backup data structure
function validateBackupData(data) {
    // Check if it's a valid backup file format
    if (data.version && data.timestamp && data.data) {
        return true;
    }
    
    // Check if it's a legacy format (just wordList array)
    if (Array.isArray(data)) {
        return true;
    }
    
    // Check if it's a simple wordList object
    if (data.wordList && Array.isArray(data.wordList)) {
        return true;
    }
    
    return false;
}

// Helper function to convert legacy formats to new format
function convertLegacyFormat(data) {
    // If it's just an array of words
    if (Array.isArray(data)) {
        return {
            data: {
                masterList: data,
                blacklist: [],
                favorites: []
            }
        };
    }
    
    // If it's a simple wordList object
    if (data.wordList && Array.isArray(data.wordList)) {
        return {
            data: {
                masterList: data.wordList,
                blacklist: data.blacklist || [],
                favorites: data.favorites || []
            }
        };
    }
    
    // If it's already in the new format
    if (data.data && data.data.masterList) {
        return data;
    }
    
    throw new Error("Unsupported backup file format.");
}

// --- Rhyme Finder Modal Cleanup ---
// Internal helper, called by closeModal
function clearRhymeModal() {
     if(ui.elements.rhymeResultsList) ui.elements.rhymeResultsList.innerHTML = '';
     if(ui.elements.rhymeModalBaseWord) ui.elements.rhymeModalBaseWord.textContent = '';
     if(ui.elements.rhymeModalPatternContainer) ui.elements.rhymeModalPatternContainer.innerHTML = '';
     if(ui.elements.manualRhymeInput) ui.elements.manualRhymeInput.value = '';
     if(ui.elements.rhymeNoResults) ui.elements.rhymeNoResults.style.display = 'none';
}

// Note: showRhymeFinder logic remains in rhyme.js
// addManualRhyme logic remains in rhyme.js

// --- Settings Modal ---
export function showSettingsModal() {
    if (!ui.elements.settingsModal) return;
    
    updateDataSummary();
    openModal(ui.elements.settingsModal);
}

function updateDataSummary() {
    const summaryElement = document.getElementById('data-summary');
    if (!summaryElement) return;
    
    const summary = `
        <div class="data-summary-grid">
            <div class="summary-item">
                <span class="summary-label">Words in List:</span>
                <span class="summary-value">${state.wordList.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Favorites:</span>
                <span class="summary-value">${state.favorites.size}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Blacklisted:</span>
                <span class="summary-value">${state.blacklist.size}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Tracked Words:</span>
                <span class="summary-value">${Object.keys(state.wordFrequencies).length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Manual Rhymes:</span>
                <span class="summary-value">${Object.keys(state.manualRhymes).length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Rejected Rhymes:</span>
                <span class="summary-value">${Object.keys(state.rejectedRhymes).length}</span>
            </div>
        </div>
    `;
    
    summaryElement.innerHTML = summary;
}

// Settings modal action handlers
export function clearBlacklist() {
    if (state.blacklist.size === 0) {
        ui.showFeedback("Blacklist is already empty.", true, 2000);
        return;
    }
    
    if (confirm(`Are you sure you want to clear all ${state.blacklist.size} blacklisted words?`)) {
        state.blacklist.clear();
        storage.saveSettings();
        updateDataSummary();
        ui.showFeedback("Blacklist cleared successfully!", false, 2000);
    }
}

export function clearWordFrequencies() {
    const frequencyCount = Object.keys(state.wordFrequencies).length;
    if (frequencyCount === 0) {
        ui.showFeedback("No word frequencies to clear.", true, 2000);
        return;
    }
    
    if (confirm(`Are you sure you want to clear all ${frequencyCount} word frequency records?`)) {
        state.wordFrequencies = {};
        storage.saveSettings();
        ui.displayFrequencies(state.wordFrequencies);
        updateDataSummary();
        ui.showFeedback("Word frequencies cleared successfully!", false, 2000);
    }
}

export function resetAllSettings() {
    if (confirm('Are you sure you want to reset ALL settings to defaults? This will clear all data including favorites, blacklist, word frequencies, and custom word lists.')) {
        storage.resetToDefaults(true);
        updateDataSummary();
        ui.showFeedback("All settings reset to defaults!", false, 3000);
    }
}

export function exportAllSettings() {
    storage.exportSettings();
}

export function importAllSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = storage.importSettings(e.target.result);
            if (success) {
                updateDataSummary();
            }
        };
        reader.readAsText(file);
    };
    input.click();
}