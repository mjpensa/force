/**
 * Router - Handles hash-based navigation between different sections
 */
class Router {
    constructor() {
        this.routes = {
            'roadmap': () => this.showSection('roadmap'),
            'presentation': () => this.showSection('presentation')
        };
        this.currentRoute = null;
        this.ganttChart = null;
        this.presentationSlides = null;
        this.hamburgerMenu = null;

        // Bind event handlers
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    /**
     * Initialize the router with component references
     */
    init(ganttChart, presentationSlides) {
        console.log('🚀 Router.init called with:', {
            ganttChart: !!ganttChart,
            presentationSlides: !!presentationSlides,
            presentationSlidesContainer: !!presentationSlides?.container
        });

        this.ganttChart = ganttChart;
        this.presentationSlides = presentationSlides;
        this.hamburgerMenu = ganttChart?.hamburgerMenu;

        // Listen for hash changes
        window.addEventListener('hashchange', this.handleHashChange);

        console.log('✅ Router initialized, calling initial handleHashChange...');

        // Handle initial route
        this.handleHashChange();
    }

    /**
     * Handle hash changes in the URL
     */
    handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove the '#'
        const route = hash || 'roadmap'; // Default to roadmap

        console.log('🔗 Hash changed:', {
            hash: hash,
            route: route,
            fullHash: window.location.hash
        });

        if (this.routes[route]) {
            this.routes[route]();
            this.currentRoute = route;
        } else {
            // Unknown route, redirect to roadmap
            console.warn('⚠️ Unknown route:', route, '- redirecting to roadmap');
            this.navigate('roadmap');
        }
    }

    /**
     * Navigate to a specific route
     */
    navigate(route) {
        window.location.hash = route;
    }

    /**
     * Show a specific section and hide others
     */
    showSection(section) {
        console.log('🔄 Router.showSection called with section:', section);

        // Update hamburger menu active item
        if (this.hamburgerMenu) {
            this.hamburgerMenu.updateActiveItem(section);
        }

        // Get container elements - use multiple strategies to ensure we find them
        // Note: Don't hide chartWrapper itself, as it contains all sections
        const ganttGrid = document.querySelector('.gantt-grid');
        const ganttTitle = document.querySelector('.gantt-title');
        const slidesContainer = this.presentationSlides?.container || document.getElementById('presentationSlides');

        console.log('📦 Container references:', {
            ganttGrid: !!ganttGrid,
            ganttTitle: !!ganttTitle,
            slidesContainer: !!slidesContainer,
            ganttChart: !!this.ganttChart,
            presentationSlides: !!this.presentationSlides
        });

        // Warn if containers are missing
        if (!slidesContainer) {
            console.warn('⚠️ Presentation Slides container not found');
        }

        // Also get the legend and other Gantt-specific elements
        const legend = document.querySelector('.gantt-legend');
        const exportContainer = document.querySelector('.export-container');
        const todayLine = document.querySelector('.today-line');

        switch (section) {
            case 'roadmap':
                // Show only the Gantt chart elements
                if (ganttGrid) {
                    ganttGrid.style.display = '';
                }
                if (ganttTitle) {
                    ganttTitle.style.display = '';
                }
                if (legend) {
                    legend.style.display = '';
                }
                if (todayLine) {
                    todayLine.style.display = '';
                }
                if (exportContainer) {
                    exportContainer.style.display = '';
                }
                if (slidesContainer) {
                    slidesContainer.style.display = 'none';
                    slidesContainer.classList.remove('section-isolated');
                }
                break;

            case 'presentation':
                // Show only the Presentation Slides
                if (ganttGrid) {
                    ganttGrid.style.display = 'none';
                }
                if (ganttTitle) {
                    ganttTitle.style.display = 'none';
                }
                if (legend) {
                    legend.style.display = 'none';
                }
                if (todayLine) {
                    todayLine.style.display = 'none';
                }
                if (exportContainer) {
                    exportContainer.style.display = 'none';
                }
                if (slidesContainer) {
                    slidesContainer.style.display = '';
                    slidesContainer.classList.add('section-isolated');
                }
                break;

            default:
                console.warn(`Unknown section: ${section}`);
        }

        // Scroll to top when switching sections
        window.scrollTo(0, 0);
    }

    /**
     * Get the current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
    }
}

// Make Router available globally
window.Router = Router;
