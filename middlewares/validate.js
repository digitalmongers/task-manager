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
        .map((detail) => detail.message.replace(/['"]/g, ''))
        .join(', ');
      
      return next(ApiError.unprocessableEntity(errorMessage));
    }

    
    if (value.body) req.body = value.body;
    if (value.params) req.params = value.params;
    if (value.query) req.query = value.query;

    next();
  };
};

export default validate;
