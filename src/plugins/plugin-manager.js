class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginConfigs = new Map();
  }

  // Load plugins from a plugins directory
  loadPlugins() {
    // For now, just initialize an empty plugin system
    // In the future, this could scan a plugins directory and load plugin files
    console.log('🔌 Plugin system initialized (no plugins loaded)');
  }

  // Initialize plugins with app and io instances
  initPlugins(app, io, sharedState) {
    // Initialize any loaded plugins
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if (typeof plugin.init === 'function') {
          plugin.init(app, io, sharedState);
          console.log(`✅ Plugin ${pluginName} initialized`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize plugin ${pluginName}:`, error);
      }
    }
  }

  // Register a plugin
  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin);
    console.log(`📦 Plugin ${name} registered`);
  }

  // Get all loaded plugins
  getAllPlugins() {
    return Array.from(this.plugins.keys());
  }

  // Get plugin configuration
  getPluginConfig(name) {
    return this.pluginConfigs.get(name) || {};
  }

  // Set plugin configuration
  setPluginConfig(name, config) {
    this.pluginConfigs.set(name, config);
  }
}

module.exports = PluginManager;
