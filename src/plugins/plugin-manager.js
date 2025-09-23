const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginDir = path.join(__dirname, '..', '..', 'plugins');
  }

  loadPlugins() {
    try {
      // Ensure plugins directory exists
      if (!fs.existsSync(this.pluginDir)) {
        fs.mkdirSync(this.pluginDir, { recursive: true });
        console.log('📁 Created plugins directory');
        return;
      }

      const pluginFiles = fs.readdirSync(this.pluginDir)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(this.pluginDir, file));

      console.log(`🔌 Loading ${pluginFiles.length} plugins...`);

      for (const pluginFile of pluginFiles) {
        try {
          const plugin = require(pluginFile);
          const pluginName = path.basename(pluginFile, '.js');

          if (plugin && typeof plugin.init === 'function') {
            this.plugins.set(pluginName, plugin);
            console.log(`✅ Loaded plugin: ${pluginName}`);
          } else {
            console.warn(`⚠️ Plugin ${pluginName} does not export an init function`);
          }
        } catch (error) {
          console.error(`❌ Failed to load plugin ${pluginFile}:`, error.message);
        }
      }

      console.log(`🔌 Loaded ${this.plugins.size} plugins successfully`);
    } catch (error) {
      console.error('❌ Error loading plugins:', error);
    }
  }

  initPlugins(app, io, sharedState) {
    for (const [pluginName, plugin] of this.plugins) {
      try {
        plugin.init(app, io, sharedState);
        console.log(`🚀 Initialized plugin: ${pluginName}`);
      } catch (error) {
        console.error(`❌ Failed to initialize plugin ${pluginName}:`, error);
      }
    }
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.plugins.keys());
  }

  unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin && typeof plugin.cleanup === 'function') {
      try {
        plugin.cleanup();
      } catch (error) {
        console.error(`❌ Error cleaning up plugin ${name}:`, error);
      }
    }
    this.plugins.delete(name);
    console.log(`🗑️ Unloaded plugin: ${name}`);
  }

  reloadPlugin(name) {
    this.unloadPlugin(name);

    const pluginFile = path.join(this.pluginDir, `${name}.js`);
    if (fs.existsSync(pluginFile)) {
      // Clear require cache
      delete require.cache[require.resolve(pluginFile)];

      try {
        const plugin = require(pluginFile);
        if (plugin && typeof plugin.init === 'function') {
          this.plugins.set(name, plugin);
          console.log(`🔄 Reloaded plugin: ${name}`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Failed to reload plugin ${name}:`, error);
      }
    }
    return false;
  }
}

module.exports = PluginManager;
