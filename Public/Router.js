/**
 * Router - Handles hash-based navigation between different sections
 */
class Router {
    constructor() {
        this.routes = {
            'roadmap': () => this.showSection('roadmap'),
            'executive-summary': () => this.showSection('executive-summary'),
            'presentation': () => this.showSection('presentation'),
            'research-synthesis': () => this.showSection('research-synthesis')
        };
        this.currentRoute = null;
        this.ganttChart = null;
        this.executiveSummary = null;
        this.presentationSlides = null;
        this.researchSynthesizer = null;
        this.hamburgerMenu = null;

        // Bind event handlers
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    /**
     * Initialize the router with component references
     */
    init(ganttChart, executiveSummary, presentationSlides, researchSynthesizer = null) {
        console.log('🚀 Router.init called with:', {
            ganttChart: !!ganttChart,
            executiveSummary: !!executiveSummary,
            presentationSlides: !!presentationSlides,
            researchSynthesizer: !!researchSynthesizer,
            executiveSummaryContainer: !!executiveSummary?.container,
            presentationSlidesContainer: !!presentationSlides?.container
        });

        this.ganttChart = ganttChart;
        this.executiveSummary = executiveSummary;
        this.presentationSlides = presentationSlides;
        this.researchSynthesizer = researchSynthesizer;
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
        const summaryContainer = this.executiveSummary?.container || document.getElementById('executiveSummary');
        const slidesContainer = this.presentationSlides?.container || document.getElementById('presentationSlides');
        const researchContainer = document.getElementById('researchSynthesis');

        console.log('📦 Container references:', {
            ganttGrid: !!ganttGrid,
            ganttTitle: !!ganttTitle,
            summaryContainer: !!summaryContainer,
            slidesContainer: !!slidesContainer,
            researchContainer: !!researchContainer,
            ganttChart: !!this.ganttChart,
            executiveSummary: !!this.executiveSummary,
            presentationSlides: !!this.presentationSlides,
            researchSynthesizer: !!this.researchSynthesizer
        });

        // Warn if containers are missing
        if (!summaryContainer) {
            console.warn('⚠️ Executive Summary container not found');
        }
        if (!slidesContainer) {
            console.warn('⚠️ Presentation Slides container not found');
        }
        if (!researchContainer) {
            console.warn('⚠️ Research Synthesis container not found');
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
                if (summaryContainer) {
                    summaryContainer.style.display = 'none';
                    summaryContainer.classList.remove('section-isolated');
                }
                if (slidesContainer) {
                    slidesContainer.style.display = 'none';
                    slidesContainer.classList.remove('section-isolated');
                }
                if (researchContainer) {
                    researchContainer.style.display = 'none';
                    researchContainer.classList.remove('section-isolated');
                }
                break;

            case 'executive-summary':
                // Show only the Executive Summary
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
                if (summaryContainer) {
                    summaryContainer.style.display = '';
                    summaryContainer.classList.add('section-isolated');
                }
                if (slidesContainer) {
                    slidesContainer.style.display = 'none';
                    slidesContainer.classList.remove('section-isolated');
                }
                if (researchContainer) {
                    researchContainer.style.display = 'none';
                    researchContainer.classList.remove('section-isolated');
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
                if (summaryContainer) {
                    summaryContainer.style.display = 'none';
                    summaryContainer.classList.remove('section-isolated');
                }
                if (slidesContainer) {
                    slidesContainer.style.display = '';
                    slidesContainer.classList.add('section-isolated');
                }
                if (researchContainer) {
                    researchContainer.style.display = 'none';
                    researchContainer.classList.remove('section-isolated');
                }
                break;

            case 'research-synthesis':
                // Show only the Research Synthesis
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
                if (summaryContainer) {
                    summaryContainer.style.display = 'none';
                    summaryContainer.classList.remove('section-isolated');
                }
                if (slidesContainer) {
                    slidesContainer.style.display = 'none';
                    slidesContainer.classList.remove('section-isolated');
                }
                if (researchContainer) {
                    researchContainer.style.display = '';
                    researchContainer.classList.add('section-isolated');
                    // Render the research synthesizer when showing this section
                    if (this.researchSynthesizer && typeof this.researchSynthesizer.render === 'function') {
                        this.researchSynthesizer.render();
                    }
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
