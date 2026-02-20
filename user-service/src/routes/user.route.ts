import { Router, Request, Response } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import User from '../models/user.model';
import logger from '../config/logger';

const userRouter = Router();

const ADMIN_EMAILS = [
  'admin@example.com',
  'chatterjeesayan1009@gmail.com', // Adding yourself/user by default
];

userRouter.get('/profile', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const userName = (req as any).userName;
    const userEmail = (req as any).userEmail;

    let user = await User.findById(userId);

    if (!user && userId) {
      logger.info(`User not found in DB but headers exist. Creating profile on-demand for: ${userId}`);
      user = await User.create({
        _id: userId,
        name: userName || 'User',
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toJSON();
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    res.json({
      ...userData,
      email: userEmail,
      isAdmin
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /all - Get all users (for admin dashboard)
userRouter.get('/all', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userEmail = (req as any).userEmail;

    if (!ADMIN_EMAILS.includes(userEmail)) {
      logger.warn(`Unauthorized access attempt to /all by ${userEmail}`);
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /warning/:userId - Increment warning count for a user
userRouter.post('/warning/:userId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { warningCount: 1 } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`Warning count incremented for user ${userId}: ${user.warningCount}`);
    res.json({ warningCount: user.warningCount });
  } catch (error) {
    logger.error('Error incrementing warning count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

userRouter.post('/profile', async (req: Request, res: Response) => {
  try {
    const { userId, name } = req.body;
    const sagaId = req.headers['x-saga-id'];

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    logger.info(`Creating user profile for saga: ${sagaId}, userId: ${userId}`);

    const existingUser = await User.findById(userId);
    if (existingUser) {
      logger.warn(`User profile already exists for ${userId}`);
      return res.status(200).json(existingUser);
    }

    const user = await User.create({
      _id: userId,
      name: name || 'User',
    });

    logger.info(`User profile created: ${user._id}`);
    res.status(201).json(user);
  } catch (error: any) {
    logger.error('Error creating user profile:', error);
    res.status(500).json({ message: 'Failed to create profile', error: error.message });
  }
});

userRouter.delete('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sagaId = req.headers['x-saga-id'];

    logger.info(`Deleting user profile for saga: ${sagaId}, userId: ${userId}`);

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      logger.warn(`User profile not found for deletion: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`User profile deleted: ${userId}`);
    res.json({ message: 'Profile deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting user profile:', error);
    res.status(500).json({ message: 'Failed to delete profile', error: error.message });
  }
});

export { userRouter };
