// Plugin system for extending the server

const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor() {
    this.plugins = new Map();
  }

  loadPlugins() {
    const pluginsDir = path.join(__dirname, '..', 'plugins');

    if (!fs.existsSync(pluginsDir)) {
      console.log('No plugins directory found');
      return;
    }

    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

    for (const file of pluginFiles) {
      try {
        const pluginPath = path.join(pluginsDir, file);
        const plugin = require(pluginPath);

        if (plugin.name && plugin.init) {
          this.plugins.set(plugin.name, plugin);
          console.log(`Loaded plugin: ${plugin.name}`);
        } else {
          console.warn(`Invalid plugin structure in ${file}`);
        }
      } catch (error) {
        console.error(`Error loading plugin ${file}:`, error);
      }
    }
  }

  initPlugins(app, io, sharedState) {
    for (const [name, plugin] of this.plugins) {
      try {
        plugin.init(app, io, sharedState);
        console.log(`Initialized plugin: ${name}`);
      } catch (error) {
        console.error(`Error initializing plugin ${name}:`, error);
      }
    }
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.plugins.keys());
  }
}

module.exports = PluginManager;