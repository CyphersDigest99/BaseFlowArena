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
    // Call the logic in wordManager to update the list and state
    const success = wordManager.applyWordListChanges(ui.elements.wordListTextarea.value);
    if (success) {
        // Close modal only if changes were successfully applied
        closeModal(ui.elements.wordListEditorModal);
    }
    // Feedback is handled within applyWordListChanges
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