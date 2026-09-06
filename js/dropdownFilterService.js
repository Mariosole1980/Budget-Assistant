(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DropdownFilterService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';


function toggleCustomDropdown(event, type) {
  event.stopPropagation();

  // Close all other dropdowns
  const allContainers = document.querySelectorAll('.custom-select-container');
  allContainers.forEach(container => {
    if (container.id !== `custom-select-container-${type}`) {
      container.classList.remove('dropdown-open');
    }
  });

  const container = document.getElementById(`custom-select-container-${type}`);
  if (container) {
    container.classList.toggle('dropdown-open');
  }
}

function selectCustomDropdownOption(type, value, label) {
  const nativeSelect = document.getElementById(`search-filter-${type}`);
  if (!nativeSelect) return;

  nativeSelect.value = value;

  const container = document.getElementById(`custom-select-container-${type}`);
  if (container) {
    const triggerText = container.querySelector('.custom-select-trigger-text');
    if (triggerText) {
      triggerText.textContent = label;
    }

    // Update active state in UI list
    const options = container.querySelectorAll('.custom-select-option');
    options.forEach(opt => {
      if (opt.getAttribute('data-value') === value) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });

    container.classList.remove('dropdown-open');
  }

  // Dispatch native change event
  if (nativeSelect.onchange) {
    nativeSelect.onchange();
  } else {
    nativeSelect.dispatchEvent(new Event('change'));
  }
}

function syncCustomSelect(type) {
  const nativeSelect = document.getElementById(`search-filter-${type}`);
  const optionsContainer = document.getElementById(`custom-options-${type}`);
  if (!nativeSelect || !optionsContainer) return;

  optionsContainer.innerHTML = '';
  const selectedValue = nativeSelect.value;
  let activeLabel = '';

  Array.from(nativeSelect.options).forEach(opt => {
    const isSelected = opt.value === selectedValue;
    if (isSelected) {
      activeLabel = opt.textContent;
    }

    const div = document.createElement('div');
    div.className = `custom-select-option${isSelected ? ' active' : ''}`;
    div.setAttribute('data-value', opt.value);
    div.innerHTML = `
      <span>${opt.textContent}</span>
      <i class="fa-solid fa-check check-icon"></i>
    `;

    div.onclick = function (e) {
      e.stopPropagation();
      selectCustomDropdownOption(type, opt.value, opt.textContent);
    };

    optionsContainer.appendChild(div);
  });

  const container = document.getElementById(`custom-select-container-${type}`);
  if (container && activeLabel) {
    const triggerText = container.querySelector('.custom-select-trigger-text');
    if (triggerText) {
      triggerText.textContent = activeLabel;
    }
  }
}

function updateCustomSelectTriggers() {
  ['type', 'account', 'category', 'subcategory'].forEach(type => {
    const nativeSelect = document.getElementById(`search-filter-${type}`);
    if (nativeSelect) {
      const selectedOpt = nativeSelect.options[nativeSelect.selectedIndex];
      const label = selectedOpt ? selectedOpt.textContent : '';
      const container = document.getElementById(`custom-select-container-${type}`);
      if (container) {
        const triggerText = container.querySelector('.custom-select-trigger-text');
        if (triggerText) {
          triggerText.textContent = label;
        }

        const optionDivs = container.querySelectorAll('.custom-select-option');
        optionDivs.forEach(opt => {
          if (opt.getAttribute('data-value') === nativeSelect.value) {
            opt.classList.add('active');
          } else {
            opt.classList.remove('active');
          }
        });
      }
    }
  });
}

// Global outside click handler to close open custom selects
window.addEventListener('click', function (e) {
  if (!e.target.closest('.custom-select-container')) {
    const allContainers = document.querySelectorAll('.custom-select-container');
    allContainers.forEach(container => {
      container.classList.remove('dropdown-open');
    });
  }
});


  // Global outside click handler to close open custom selects
  if (typeof window !== 'undefined') {
    window.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('.custom-select-container')) {
        const allContainers = document.querySelectorAll('.custom-select-container');
        allContainers.forEach(container => {
          container.classList.remove('dropdown-open');
        });
      }
    });

    // Window bindings for inline HTML event attributes
    window.toggleCustomDropdown = toggleCustomDropdown;
    window.selectCustomDropdownOption = selectCustomDropdownOption;
    window.syncCustomSelect = syncCustomSelect;
    window.updateCustomSelectTriggers = updateCustomSelectTriggers;
  }

  return {
    toggleCustomDropdown,
    selectCustomDropdownOption,
    syncCustomSelect,
    updateCustomSelectTriggers
  };
}));
