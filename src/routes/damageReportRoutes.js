const express = require('express');
const damageReportService = require('../services/damageReportService');
const damageReportPdfService = require('../services/damageReportPdfService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res, next) => {
  try { res.json(damageReportService.listReports(req.query)); } catch (error) { next(error); }
});

router.get('/export.csv', (req, res, next) => {
  try {
    const csv = damageReportService.exportCsv(req.query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reportes-danos-${date}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
});

router.get('/export.pdf', async (req, res, next) => {
  try {
    const reports = damageReportService.listReports(req.query);
    const pdf = await damageReportPdfService.generateDamageReportsPdf({
      reports,
      filters: req.query,
      generatedBy: req.user
    });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reportes-danos-${date}.pdf"`);
    res.send(pdf);
  } catch (error) { next(error); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(damageReportService.getReport(req.params.id)); } catch (error) { next(error); }
});

router.patch('/:id', requireRole('admin', 'operador', 'curadora'), (req, res, next) => {
  try { res.json(damageReportService.updateReport(req.params.id, req.body, req.user)); } catch (error) { next(error); }
});

module.exports = router;
