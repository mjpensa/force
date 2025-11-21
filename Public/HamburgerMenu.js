/**
 * HamburgerMenu Module
 * Provides navigation between the three main sections of the presentation:
 * 1. Roadmap (Gantt Chart)
 * 2. Executive Summary
 * 3. Presentation Slides
 * Each section is displayed in a separate full-screen view
 */

/**
 * HamburgerMenu Class
 * Responsible for rendering and managing the hamburger menu navigation
 */
export class HamburgerMenu {
  /**
   * Creates a new HamburgerMenu instance
   * @param {Router} router - The router instance for navigation
   */
  constructor(router) {
    this.isOpen = false;
    this.menuElement = null;
    this.router = router;
    this.currentSection = 'roadmap'; // Track current section: 'roadmap', 'executive-summary', 'presentation', 'research-synthesis'
  }

  /**
   * Renders the hamburger menu
   * @returns {HTMLElement} The hamburger menu element
   */
  render() {
    // Create main container
    const container = document.createElement('div');
    container.className = 'hamburger-menu-container';

    // Create hamburger icon button
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-button';
    hamburgerBtn.setAttribute('aria-label', 'Navigation menu');
    hamburgerBtn.innerHTML = `
      <div class="hamburger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    // Create navigation menu
    const navMenu = document.createElement('nav');
    navMenu.className = 'hamburger-nav';
    navMenu.innerHTML = `
      <ul class="hamburger-nav-list">
        <li>
          <a href="#roadmap" class="hamburger-nav-item active" data-section="roadmap">
            <span class="nav-icon">📊</span>
            <span class="nav-text">Roadmap</span>
          </a>
        </li>
        <li>
          <a href="#executive-summary" class="hamburger-nav-item" data-section="executive-summary">
            <span class="nav-icon">📋</span>
            <span class="nav-text">Executive Summary</span>
          </a>
        </li>
        <li>
          <a href="#presentation" class="hamburger-nav-item" data-section="presentation">
            <span class="nav-icon">🎯</span>
            <span class="nav-text">Presentation</span>
          </a>
        </li>
        <li>
          <a href="#research-synthesis" class="hamburger-nav-item" data-section="research-synthesis">
            <span class="nav-icon">🔬</span>
            <span class="nav-text">Research Synthesis</span>
          </a>
        </li>
      </ul>
    `;

    // Add elements to container
    container.appendChild(hamburgerBtn);
    container.appendChild(navMenu);

    // Store reference to menu element
    this.menuElement = container;

    // Add event listeners
    this._attachEventListeners(hamburgerBtn, navMenu);

    return container;
  }

  /**
   * Attaches event listeners to the hamburger menu
   * @private
   */
  _attachEventListeners(hamburgerBtn, navMenu) {
    // Toggle menu on button click
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMenu(hamburgerBtn, navMenu);
    });

    // Handle navigation clicks
    const navItems = navMenu.querySelectorAll('.hamburger-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't prevent default - let the hash link work
        this._closeMenu(hamburgerBtn, navMenu);

        // Update active state in menu
        navItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.menuElement.contains(e.target)) {
        this._closeMenu(hamburgerBtn, navMenu);
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this._closeMenu(hamburgerBtn, navMenu);
      }
    });
  }

  /**
   * Toggles the menu open/closed state
   * @private
   */
  _toggleMenu(hamburgerBtn, navMenu) {
    if (this.isOpen) {
      this._closeMenu(hamburgerBtn, navMenu);
    } else {
      this._openMenu(hamburgerBtn, navMenu);
    }
  }

  /**
   * Opens the navigation menu
   * @private
   */
  _openMenu(hamburgerBtn, navMenu) {
    this.isOpen = true;
    hamburgerBtn.classList.add('active');
    navMenu.classList.add('active');
  }

  /**
   * Closes the navigation menu
   * @private
   */
  _closeMenu(hamburgerBtn, navMenu) {
    this.isOpen = false;
    hamburgerBtn.classList.remove('active');
    navMenu.classList.remove('active');
  }

  /**
   * Updates the active menu item based on the current route
   * @param {string} section - The section to mark as active ('roadmap', 'executive-summary', or 'presentation')
   */
  updateActiveItem(section) {
    this.currentSection = section;

    // Update active state in menu
    const navItems = this.menuElement?.querySelectorAll('.hamburger-nav-item');
    if (navItems) {
      navItems.forEach(item => {
        const itemSection = item.getAttribute('data-section');
        if (itemSection === section) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  /**
   * Gets the current active section
   * @returns {string} The current section identifier
   */
  getCurrentSection() {
    return this.currentSection;
  }
}
