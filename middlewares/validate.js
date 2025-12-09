import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';
import Joi from 'joi';


const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, 
      allowUnknown: true, 
      stripUnknown: true, 
    };

    const toValidate = {};
    
    if (schema.body) toValidate.body = req.body;
    if (schema.params) toValidate.params = req.params;
    if (schema.query) toValidate.query = req.query;

    const schemaToValidate = {};
    if (schema.body) schemaToValidate.body = schema.body;
    if (schema.params) schemaToValidate.params = schema.params;
    if (schema.query) schemaToValidate.query = schema.query;

    const { error, value } = Joi.object(schemaToValidate)
      .validate(toValidate, validationOptions);

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message.replace(/['\"]/g, ''))
        .join(', ');
      
      return next(ApiError.unprocessableEntity(errorMessage));
    }

    
    // Update req with validated values
    if (value.body) req.body = value.body;
    if (value.params) req.params = value.params;
    
    // For query, use Object.defineProperty to avoid readonly issue
    if (value.query) {
      Object.defineProperty(req, 'query', {
        value: value.query,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }

    next();
  };
};

export default validate;
