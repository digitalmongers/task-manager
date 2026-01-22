import PDFDocument from 'pdfkit-table';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import User from '../models/User.js';
import Logger from '../config/logger.js';

class ExportService {
  /**
   * Generate PDF for User Data
   * @param {string} userId
   * @param {object} res - Express response object
   */
  async generateUserDataPdf(userId, res) {
    try {
      const user = await User.findById(userId);
      const tasks = await Task.find({ user: userId, isDeleted: false })
        .populate('status', 'name')
        .populate('priority', 'name')
        .populate('category', 'title')
        .sort({ createdAt: -1 });

      const vitalTasks = await VitalTask.find({ user: userId, isDeleted: false })
        .populate('status', 'name')
        .populate('priority', 'name')
        .populate('category', 'title')
        .sort({ createdAt: -1 });

      // Create PDF Document
      const doc = new PDFDocument({ margin: 30, size: 'A4' });

      // Pipe to response
      doc.pipe(res);

      // --- Header ---
      doc.fontSize(20).text('User Data Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown();
      
      // --- User Profile ---
      doc.fontSize(16).text('User Profile', { underline: true });
      doc.fontSize(10).text(`Name: ${user.firstName} ${user.lastName}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Account Created: ${user.createdAt.toLocaleDateString()}`);
      doc.moveDown();

      // --- Summary Statistics ---
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.isCompleted).length;
      const pendingTasks = totalTasks - completedTasks; 
      
      const totalVital = vitalTasks.length;
      const completedVital = vitalTasks.filter(t => t.isCompleted).length;

      doc.fontSize(16).text('Summary Statistics', { underline: true });
      const tableData = {
        headers: ['Metric', 'Regular Tasks', 'Vital Tasks'],
        rows: [
            ['Total', totalTasks, totalVital],
            ['Completed', completedTasks, completedVital],
            ['Pending', pendingTasks, totalVital - completedVital]
        ]
      };

      await doc.table(tableData, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
        prepareRow: (row, indexColumn, indexRow, rect, rowData) => doc.font('Helvetica').fontSize(10),
      });
      
      doc.moveDown();

      // --- Regular Tasks Table ---
      if (tasks.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Regular Tasks List', { underline: true });
        doc.moveDown();

        const taskTable = {
            title: "Your Tasks",
            headers: ["Title", "Status", "Priority", "Completed", "Due Date"],
            rows: tasks.map(t => [
                t.title.substring(0, 30) + (t.title.length > 30 ? '...' : ''),
                t.status?.name || 'N/A',
                t.priority?.name || 'N/A',
                t.isCompleted ? 'Yes' : 'No',
                t.dueDate ? t.dueDate.toLocaleDateString() : 'None'
            ])
        };

        await doc.table(taskTable, {
            width: 500,
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8),
            prepareRow: () => doc.font('Helvetica').fontSize(8)
        });
      }

      // --- Vital Tasks Table ---
      if (vitalTasks.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Vital Tasks List', { underline: true });
        doc.moveDown();

        const vitalTable = {
            title: "Your Vital Tasks",
             headers: ["Title", "Status", "Priority", "Completed", "Due Date"],
            rows: vitalTasks.map(t => [
                t.title.substring(0, 30) + (t.title.length > 30 ? '...' : ''),
                t.status?.name || 'N/A',
                t.priority?.name || 'N/A',
                t.isCompleted ? 'Yes' : 'No',
                t.dueDate ? t.dueDate.toLocaleDateString() : 'None'
            ])
        };

         await doc.table(vitalTable, {
            width: 500,
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8),
             prepareRow: () => doc.font('Helvetica').fontSize(8)
        });
      }

      // Finalize
      doc.end();

      Logger.info('PDF Export generated successfully', { userId });

    } catch (error) {
      Logger.error('Error generating PDF export', { error: error.message, userId });
      if (!res.headersSent) {
          throw error;
      }
    }
  }
}

export default new ExportService();
