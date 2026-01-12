import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import User from '../models/user.model';

const userRouter = Router();

userRouter.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export { userRouter };
