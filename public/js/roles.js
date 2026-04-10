// public/js/roles.js
// Enables/disables host-only UI controls based on the current user's role.
// Called once when the session connects and again whenever host status changes.

/**
 * Apply role-based UI state.
 * @param {boolean} isHostNow - true if the current user is the host.
 */
export function applyRoleUI(isHostNow) {
  document.querySelectorAll('[data-host-only]').forEach(el => {
    if (isHostNow) {
      el.style.opacity = '';
      el.style.pointerEvents = '';
      el.removeAttribute('aria-disabled');
    } else {
      el.style.opacity = '0.35';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-disabled', 'true');
    }
  });
}
