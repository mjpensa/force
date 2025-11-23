/**
 * Router - Handles hash-based navigation between different sections
 */
class Router {
    constructor() {
        this.routes = {
            'roadmap': () => this.showSection('roadmap')
        };
        this.currentRoute = null;
        this.ganttChart = null;
        this.hamburgerMenu = null;

        // Bind event handlers
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    /**
     * Initialize the router with component references
     */
    init(ganttChart) {
        console.log('🚀 Router.init called with:', {
            ganttChart: !!ganttChart
        });

        this.ganttChart = ganttChart;
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

        // Get container elements
        const ganttGrid = document.querySelector('.gantt-grid');
        const ganttTitle = document.querySelector('.gantt-title');

        console.log('📦 Container references:', {
            ganttGrid: !!ganttGrid,
            ganttTitle: !!ganttTitle,
            ganttChart: !!this.ganttChart
        });

        // Also get the legend and other Gantt-specific elements
        const legend = document.querySelector('.gantt-legend');
        const exportContainer = document.querySelector('.export-container');
        const todayLine = document.querySelector('.today-line');

        switch (section) {
            case 'roadmap':
                // Show the Gantt chart elements
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
