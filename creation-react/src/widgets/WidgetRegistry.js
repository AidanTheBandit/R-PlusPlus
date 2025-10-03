/**
 * WidgetRegistry - Manages widget definitions and registration for R1 device
 * Handles widget discovery, registration, and metadata management
 */

class WidgetRegistry {
    constructor() {
        this.widgets = new Map();
        this.categories = new Map();
    }

    /**
     * Register a new widget definition
     * @param {WidgetDefinition} widget - Widget definition object
     */
    register(widget) {
        if (!widget.id || !widget.name || !widget.component) {
            throw new Error('Widget must have id, name, and component properties');
        }

        if (this.widgets.has(widget.id)) {
            throw new Error(`Widget with id "${widget.id}" is already registered`);
        }

        // Validate widget definition structure
        this._validateWidgetDefinition(widget);

        // Store widget definition
        this.widgets.set(widget.id, {
            ...widget,
            registeredAt: new Date(),
            version: widget.version || '1.0.0'
        });

        // Update category index
        const category = widget.category || 'custom';
        if (!this.categories.has(category)) {
            this.categories.set(category, new Set());
        }
        this.categories.get(category).add(widget.id);

        console.log(`Widget "${widget.name}" (${widget.id}) registered successfully`);
    }

    /**
     * Unregister a widget
     * @param {string} widgetId - Widget ID to unregister
     */
    unregister(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (!widget) {
            throw new Error(`Widget with id "${widgetId}" not found`);
        }

        // Remove from category index
        const category = widget.category || 'custom';
        if (this.categories.has(category)) {
            this.categories.get(category).delete(widgetId);
            if (this.categories.get(category).size === 0) {
                this.categories.delete(category);
            }
        }

        // Remove widget
        this.widgets.delete(widgetId);
        console.log(`Widget "${widget.name}" (${widgetId}) unregistered`);
    }

    /**
     * Get a specific widget definition
     * @param {string} widgetId - Widget ID
     * @returns {WidgetDefinition|null} Widget definition or null if not found
     */
    getWidget(widgetId) {
        return this.widgets.get(widgetId) || null;
    }

    /**
     * Get all registered widgets
     * @returns {WidgetDefinition[]} Array of all widget definitions
     */
    getAllWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Get widgets by category
     * @param {string} category - Widget category
     * @returns {WidgetDefinition[]} Array of widgets in the category
     */
    getWidgetsByCategory(category) {
        const widgetIds = this.categories.get(category);
        if (!widgetIds) {
            return [];
        }

        return Array.from(widgetIds)
            .map(id => this.widgets.get(id))
            .filter(Boolean);
    }

    /**
     * Get all available categories
     * @returns {string[]} Array of category names
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }

    /**
     * Search widgets by name or description
     * @param {string} query - Search query
     * @returns {WidgetDefinition[]} Array of matching widgets
     */
    search(query) {
        const searchTerm = query.toLowerCase();
        return this.getAllWidgets().filter(widget =>
            widget.name.toLowerCase().includes(searchTerm) ||
            widget.description.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Validate widget definition structure
     * @private
     */
    _validateWidgetDefinition(widget) {
        const requiredFields = ['id', 'name', 'description', 'component'];

        for (const field of requiredFields) {
            if (!widget[field]) {
                throw new Error(`Widget definition missing required field: ${field}`);
            }
        }

        // Validate ID format (alphanumeric with hyphens)
        if (!/^[a-z0-9-]+$/.test(widget.id)) {
            throw new Error('Widget ID must contain only lowercase letters, numbers, and hyphens');
        }

        // Validate size constraints if provided
        if (widget.minSize) {
            this._validateSize(widget.minSize, 'minSize');
        }
        if (widget.maxSize) {
            this._validateSize(widget.maxSize, 'maxSize');
        }

        // Validate config schema if provided
        if (widget.configSchema && typeof widget.configSchema !== 'object') {
            throw new Error('Widget configSchema must be a valid JSON Schema object');
        }
    }

    /**
     * Validate size object
     * @private
     */
    _validateSize(size, fieldName) {
        if (!size.width || !size.height || size.width <= 0 || size.height <= 0) {
            throw new Error(`Widget ${fieldName} must have positive width and height values`);
        }
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getStats() {
        return {
            totalWidgets: this.widgets.size,
            categories: this.categories.size,
            widgetsByCategory: Object.fromEntries(
                Array.from(this.categories.entries()).map(([cat, widgets]) => [cat, widgets.size])
            )
        };
    }
}

// Widget categories enum
export const WidgetCategory = {
    MONITORING: 'monitoring',
    CONTROL: 'control',
    COMMUNICATION: 'communication',
    ANALYTICS: 'analytics',
    CUSTOM: 'custom'
};

export default WidgetRegistry;