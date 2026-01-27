import { HTTP_STATUS } from '../config/constants.js';


class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {Number} statusCode - HTTP status code
   * @param {String} message - Success message
   * @param {Object} data - Response data
   */
  static success(res, statusCode = HTTP_STATUS.OK, message = 'Success', data = null) {
    const response = {
      success: true,
      statusCode,
      message,
    };
  
    if (data !== null) {
      response.data = data;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {Number} statusCode - HTTP status code
   * @param {String} message - Error message
   * @param {Object} errors - Validation errors or additional error details
   */
  static error(res, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message = 'Error', errors = null) {
    const response = {
      success: false,
      statusCode,
      message,
    };

    if (errors !== null) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Paginated response
   * @param {Object} res - Express response object
   * @param {Number} statusCode - HTTP status code
   * @param {String} message - Success message
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination metadata
   */
  static paginated(res, statusCode = HTTP_STATUS.OK, message = 'Success', data = [], pagination = {}) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 0,
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false,
      },
    });
  }

  /**
   * Created response (201)
   * @param {Object} res - Express response object
   * @param {String} message - Success message
   * @param {Object} data - Created resource data
   */
  static created(res, message = 'Resource created successfully', data = null) {
    return ApiResponse.success(res, HTTP_STATUS.CREATED, message, data);
  }

  /**
   * No content response (204)
   * @param {Object} res - Express response object
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}

export default ApiResponse;
