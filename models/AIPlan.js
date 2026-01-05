import mongoose from 'mongoose';

const aiPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: ['strategic', 'weekly', 'daily'],
      default: 'strategic',
    },
    // The actual generated plan content (Markdown or specific JSON structure)
    content: {
      type: String,
      required: true,
    },
    // Meta-data about what triggered this plan or what it covers
    focusSummary: {
      type: String,
      trim: true,
    },
    // IDs of tasks included in this analysis for context tracking
    sourceTasks: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'sourceTasks.taskModel'
        },
        taskModel: {
          type: String,
          enum: ['Task', 'VitalTask'],
          default: 'VitalTask'
        },
        title: String
      }
    ],
    // For "Zero-Latency" UI: cache validity
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    }
  },
  {
    timestamps: true,
  }
);

// Index to quickly find the latest active plan for a user
aiPlanSchema.index({ user: 1, createdAt: -1 });

const AIPlan = mongoose.model('AIPlan', aiPlanSchema);

export default AIPlan;
