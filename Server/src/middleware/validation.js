import { body, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['owner', 'tenant']).withMessage('Role must be owner or tenant'),
  handleValidationErrors
];

export const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

export const validateRent = [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('month').notEmpty().withMessage('Month is required'),
  body('year')
    .notEmpty().withMessage('Year is required')
    .isInt({ min: 2070, max: 2200 }).withMessage('Year must be between 2070 and 2200'),
  body('rent')
    .notEmpty().withMessage('Rent is required')
    .isFloat({ min: 0 }).withMessage('Rent must be a positive number'),
  body('prevUnit')
    .notEmpty().withMessage('Previous unit is required')
    .isFloat({ min: 0 }).withMessage('Previous unit must be a positive number'),
  body('currUnit')
    .notEmpty().withMessage('Current unit is required')
    .isFloat({ min: 0 }).withMessage('Current unit must be a positive number'),
  body('electricityRate')
    .notEmpty().withMessage('Electricity rate is required')
    .isFloat({ min: 0 }).withMessage('Electricity rate must be a positive number'),
  body('water')
    .notEmpty().withMessage('Water charge is required')
    .isFloat({ min: 0 }).withMessage('Water charge must be a positive number'),
  body('waste')
    .notEmpty().withMessage('Waste charge is required')
    .isFloat({ min: 0 }).withMessage('Waste charge must be a positive number'),
  body('total')
    .notEmpty().withMessage('Total is required')
    .isFloat({ min: 0 }).withMessage('Total must be a positive number'),
  handleValidationErrors
];