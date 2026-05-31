/**
 * ACCOUNT DROPDOWN FIX
 * Converts native select to custom Bottom Sheet with Ελληνικά labels
 * v140+
 */

/**
 * Localize account type names
 */
function localizeAccountType(type) {
  const translations = {
    'cash': { el: 'Μετρητά', en: 'Cash' },
    'bank': { el: 'Τράπεζα', en: 'Bank' },
    'card': { el: 'Κάρτα', en: 'Card' }
  };
  
  const lang = state?.lang || 'el';
  const key = type.toLowerCase();
  
  if (translations[key]) {
    return translations[key][lang] || type;
  }
  return type;
}

/**
 * Create custom dropdown overlay for account type selection
 * Replaces native <select> with styled Bottom Sheet
 */
function createAccountTypeDropdown(selectElement) {
  if (!selectElement) return;

  const container = selectElement.parentElement;
  if (!container) return;

  // Create overlay backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'dropdown-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: none;
  `;

  // Create bottom sheet container
  const sheet = document.createElement('div');
  sheet.className = 'account-dropdown-sheet';
  sheet.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-card, #222731);
    border-radius: 12px 12px 0 0;
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    font-weight: 700;
    margin-bottom: 12px;
    color: var(--text-main, #e3e8f0);
    font-size: 16px;
  `;
  header.textContent = state?.lang === 'en' ? 'Select Account Type' : 'Επιλέξτε Τύπο Λογαριασμού';
  sheet.appendChild(header);

  // Options
  const options = ['cash', 'bank', 'card'];
  options.forEach(opt => {
    const optDiv = document.createElement('div');
    optDiv.className = 'account-dropdown-option';
    optDiv.style.cssText = `
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: var(--bg-main, #181b22);
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-main, #e3e8f0);
      font-weight: 500;
      border: 1px solid var(--border, #2e3543);
    `;

    const label = localizeAccountType(opt);
    optDiv.textContent = label;

    optDiv.addEventListener('click', () => {
      selectElement.value = opt;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Close sheet
      backdrop.style.display = 'none';
      sheet.style.display = 'none';
      
      // Update trigger button text
      const trigger = container.querySelector('[data-dropdown-trigger]');
      if (trigger) {
        trigger.textContent = label;
      }
    });

    optDiv.addEventListener('mouseenter', () => {
      optDiv.style.background = 'var(--border-light, #384152)';
    });

    optDiv.addEventListener('mouseleave', () => {
      optDiv.style.background = 'var(--bg-main, #181b22)';
    });

    sheet.appendChild(optDiv);
  });

  backdrop.addEventListener('click', () => {
    backdrop.style.display = 'none';
    sheet.style.display = 'none';
  });

  // Store references
  selectElement._dropdownSheet = sheet;
  selectElement._dropdownBackdrop = backdrop;

  // Hide original select
  selectElement.style.display = 'none';

  // Add to DOM
  container.appendChild(backdrop);
  container.appendChild(sheet);

  // Create trigger button (if not exists)
  if (!container.querySelector('[data-dropdown-trigger]')) {
    const trigger = document.createElement('button');
    trigger.setAttribute('data-dropdown-trigger', 'true');
    trigger.type = 'button';
    trigger.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-main, #181b22);
      border: 1px solid var(--border-light, #384152);
      border-radius: 8px;
      color: var(--text-main, #e3e8f0);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    trigger.innerHTML = `
      <span>${localizeAccountType(selectElement.value || 'cash')}</span>
      <i class="fa-solid fa-chevron-down" style="font-size: 12px; color: var(--text-muted);"></i>
    `;

    trigger.addEventListener('click', () => {
      backdrop.style.display = 'flex';
      sheet.style.display = 'block';
    });

    container.insertBefore(trigger, selectElement);
  }
}

/**
 * Initialize all account dropdowns on page load
 */
function initializeAccountDropdowns() {
  const accountSelects = document.querySelectorAll('[data-account-select]');
  accountSelects.forEach(select => {
    createAccountTypeDropdown(select);
  });
}
