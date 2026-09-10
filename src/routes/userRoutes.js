const express = require('express');
const userService = require('../services/userService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireRole('admin'));

router.get('/', (_req, res, next) => {
  try { res.json(userService.listUsers()); } catch (error) { next(error); }
});

router.post('/', (req, res, next) => {
  try { res.status(201).json(userService.createUser(req.body)); } catch (error) { next(error); }
});

router.patch('/:id', (req, res, next) => {
  try { res.json(userService.updateUser(req.params.id, req.body, req.user)); } catch (error) { next(error); }
});

router.patch('/:id/password', (req, res, next) => {
  try { res.json(userService.updatePassword(req.params.id, req.body)); } catch (error) { next(error); }
});

router.patch('/:id/reactivate', (req, res, next) => {
  try { res.json(userService.reactivateUser(req.params.id)); } catch (error) { next(error); }
});

router.delete('/:id/permanent', (req, res, next) => {
  try { res.json(userService.deleteUser(req.params.id, req.user)); } catch (error) { next(error); }
});

router.delete('/:id', (req, res, next) => {
  try { res.json(userService.deactivateUser(req.params.id, req.user)); } catch (error) { next(error); }
});

module.exports = router;
