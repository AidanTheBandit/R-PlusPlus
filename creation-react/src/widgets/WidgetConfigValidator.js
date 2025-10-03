/**
 * WidgetConfigValidator - JSON Schema validation for widget configurations
 * Provides validation utilities for widget config schemas
 */

class WidgetConfigValidator {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Register a widget configuration schema
   * @param {string} widgetId - Widget ID
   * @param {Object} schema - JSON Schema object
   */
  registerSchema(widgetId, schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object');
    }

    this.schemas.set(widgetId, schema);
    console.log(`Schema registered for widget: ${widgetId}`);
  }

  /**
   * Validate configuration against widget schema
   * @param {string} widgetId - Widget ID
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  validate(widgetId, config) {
    const schema = this.schemas.get(widgetId);
    if (!schema) {
      return { valid: true, errors: [] }; // No schema means no validation
    }

    const errors = [];

    try {
      // Validate required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in config)) {
            errors.push(`Required field missing: ${field}`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(config)) {
          const propSchema = schema.properties[key];
          if (propSchema) {
            const propErrors = this._validateProperty(key, value, propSchema);
            errors.push(...propErrors);
          }
        }
      }

      // Validate additional properties
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(config)) {
          if (!schema.properties || !schema.properties[key]) {
            errors.push(`Additional property not allowed: ${key}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Validate a single property against its schema
   * @private
   */
  _validateProperty(key, value, propSchema) {
    const errors = [];

    // Type validation
    if (propSchema.type) {
      const actualType = this._getType(value);
      if (actualType !== propSchema.type) {
        errors.push(`Property ${key}: expected ${propSchema.type}, got ${actualType}`);
        return errors; // Skip further validation if type is wrong
      }
    }

    // String validations
    if (propSchema.type === 'string') {
      if (propSchema.minLength && value.length < propSchema.minLength) {
        errors.push(`Property ${key}: minimum length is ${propSchema.minLength}`);
      }
      if (propSchema.maxLength && value.length > propSchema.maxLength) {
        errors.push(`Property ${key}: maximum length is ${propSchema.maxLength}`);
      }
      if (propSchema.pattern) {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          errors.push(`Property ${key}: does not match pattern ${propSchema.pattern}`);
        }
      }
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        errors.push(`Property ${key}: must be one of ${propSchema.enum.join(', ')}`);
      }
    }

    // Number validations
    if (propSchema.type === 'number' || propSchema.type === 'integer') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        errors.push(`Property ${key}: minimum value is ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        errors.push(`Property ${key}: maximum value is ${propSchema.maximum}`);
      }
      if (propSchema.type === 'integer' && !Number.isInteger(value)) {
        errors.push(`Property ${key}: must be an integer`);
      }
    }

    // Array validations
    if (propSchema.type === 'array') {
      if (propSchema.minItems && value.length < propSchema.minItems) {
        errors.push(`Property ${key}: minimum items is ${propSchema.minItems}`);
      }
      if (propSchema.maxItems && value.length > propSchema.maxItems) {
        errors.push(`Property ${key}: maximum items is ${propSchema.maxItems}`);
      }
      if (propSchema.items) {
        value.forEach((item, index) => {
          const itemErrors = this._validateProperty(`${key}[${index}]`, item, propSchema.items);
          errors.push(...itemErrors);
        });
      }
    }

    // Object validations
    if (propSchema.type === 'object' && propSchema.properties) {
      for (const [subKey, subValue] of Object.entries(value)) {
        const subSchema = propSchema.properties[subKey];
        if (subSchema) {
          const subErrors = this._validateProperty(`${key}.${subKey}`, subValue, subSchema);
          errors.push(...subErrors);
        }
      }
    }

    return errors;
  }

  /**
   * Get JavaScript type of value
   * @private
   */
  _getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Get schema for widget
   * @param {string} widgetId - Widget ID
   * @returns {Object|null} Schema object or null if not found
   */
  getSchema(widgetId) {
    return this.schemas.get(widgetId) || null;
  }

  /**
   * Remove schema for widget
   * @param {string} widgetId - Widget ID
   */
  removeSchema(widgetId) {
    this.schemas.delete(widgetId);
  }

  /**
   * Get all registered schemas
   * @returns {Object} Map of widgetId -> schema
   */
  getAllSchemas() {
    return Object.fromEntries(this.schemas);
  }

  /**
   * Create default configuration from schema
   * @param {string} widgetId - Widget ID
   * @returns {Object} Default configuration object
   */
  createDefaultConfig(widgetId) {
    const schema = this.schemas.get(widgetId);
    if (!schema || !schema.properties) {
      return {};
    }

    const defaultConfig = {};

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.default !== undefined) {
        defaultConfig[key] = propSchema.default;
      } else if (propSchema.type === 'string') {
        defaultConfig[key] = '';
      } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
        defaultConfig[key] = 0;
      } else if (propSchema.type === 'boolean') {
        defaultConfig[key] = false;
      } else if (propSchema.type === 'array') {
        defaultConfig[key] = [];
      } else if (propSchema.type === 'object') {
        defaultConfig[key] = {};
      }
    }

    return defaultConfig;
  }
}

// Common schema patterns
export const CommonSchemas = {
  // Basic widget configuration
  basic: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        default: 'Widget'
      },
      refreshInterval: {
        type: 'integer',
        minimum: 1000,
        maximum: 300000,
        default: 5000
      },
      theme: {
        type: 'string',
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      }
    },
    required: ['title']
  },

  // Color configuration
  color: {
    type: 'string',
    pattern: '^#[0-9A-Fa-f]{6}$',
    default: '#000000'
  },

  // Size configuration
  size: {
    type: 'object',
    properties: {
      width: {
        type: 'integer',
        minimum: 50,
        maximum: 1000
      },
      height: {
        type: 'integer',
        minimum: 50,
        maximum: 1000
      }
    },
    required: ['width', 'height']
  }
};

export default WidgetConfigValidator;