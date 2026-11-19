import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import { getUserLedgerWalletBalances } from '../services/ledger.service';

const serializeUser = async (user: any) => {
  const data = user.toObject();
  delete data.password;
  delete data.verificationToken;
  delete data.passwordResetToken;
  delete data.passwordResetExpires;
  delete data.twoFactorSecret;
  delete data.twoFactorBackupCodes;
  if (process.env.WALLET_LEDGER_READS_ENABLED === 'true') {
    const currency = process.env.LEDGER_DEFAULT_CURRENCY;
    if (!currency) throw new Error('LEDGER_DEFAULT_CURRENCY is not configured');
    const wallet = await getUserLedgerWalletBalances(String(user._id), currency);
    if ((user.balance > 0 && !wallet.walletAccountFound) || (user.bonusBalance > 0 && !wallet.bonusAccountFound)) {
      throw new Error('Wallet migration is incomplete for this account');
    }
    data.balance = wallet.balanceMinor / 100;
    data.bonusBalance = wallet.bonusBalanceMinor / 100;
    data.walletCurrency = wallet.currency;
  }
  return data;
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(await serializeUser(user));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile', error });
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, address } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { firstName, lastName, address },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user: await serializeUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error });
  }
};

export const updateResponsibleGaming = async (req: AuthRequest, res: Response) => {
  try {
    const { depositLimit, lossLimit, sessionTimeLimit } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'responsibleGaming.depositLimit': depositLimit,
        'responsibleGaming.lossLimit': lossLimit,
        'responsibleGaming.sessionTimeLimit': sessionTimeLimit,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Responsible gaming settings updated', user: await serializeUser(user) });
  } catch (error) {
    console.error('Update responsible gaming error:', error);
    res.status(500).json({ message: 'Failed to update settings', error });
  }
};

export const toggleFavoriteGame = async (req: AuthRequest, res: Response) => {
  try {
    const { gameId } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.favoriteGames.indexOf(gameId);
    if (index > -1) {
      user.favoriteGames.splice(index, 1);
    } else {
      user.favoriteGames.push(gameId);
    }

    await user.save();
    res.json({ message: 'Favorites updated', favoriteGames: user.favoriteGames });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Failed to update favorites', error });
  }
};

export const uploadKYCDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { documentType, documentUrl } = req.body;

    if (!documentType || !documentUrl) {
      return res.status(400).json({ message: 'Document type and URL are required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add document URL to kycDocuments array
    if (!user.kycDocuments) {
      user.kycDocuments = [];
    }
    
    // Store document as JSON string with type and URL
    const documentEntry = JSON.stringify({ type: documentType, url: documentUrl, uploadedAt: new Date() });
    user.kycDocuments.push(documentEntry);
    
    // Update KYC status to pending if not already verified
    if (user.kycStatus !== 'verified') {
      user.kycStatus = 'pending';
    }

    await user.save();

    res.json({ 
      message: 'KYC document uploaded successfully',
      kycStatus: user.kycStatus,
      kycDocuments: user.kycDocuments
    });
  } catch (error) {
    console.error('Upload KYC document error:', error);
    res.status(500).json({ message: 'Failed to upload KYC document', error });
  }
};

export const getKYCDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('kycDocuments kycStatus');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      kycStatus: user.kycStatus,
      kycDocuments: user.kycDocuments || []
    });
  } catch (error) {
    console.error('Get KYC documents error:', error);
    res.status(500).json({ message: 'Failed to fetch KYC documents', error });
  }
};
