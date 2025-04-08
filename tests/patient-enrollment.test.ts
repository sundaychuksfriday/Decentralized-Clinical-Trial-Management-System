import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  participants: new Map(),
  trials: new Map(),
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Example admin address
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Start with admin as sender
  blockHeight: 100,
  
  // Constants
  ERR_UNAUTHORIZED: 1,
  ERR_ALREADY_ENROLLED: 2,
  ERR_TRIAL_INACTIVE: 3,
  ERR_NOT_FOUND: 4,
  
  // Helper to set tx-sender for testing
  setTxSender(address) {
    this.txSender = address;
  },
  
  // Contract functions
  isAdmin() {
    return this.txSender === this.admin;
  },
  
  getParticipant(participantId) {
    const key = JSON.stringify({ participantId });
    return this.participants.has(key) ? this.participants.get(key) : null;
  },
  
  getTrial(trialId) {
    const key = JSON.stringify({ trialId });
    return this.trials.has(key) ? this.trials.get(key) : null;
  },
  
  registerTrial(trialId, trialName, startDate, endDate) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const key = JSON.stringify({ trialId });
    this.trials.set(key, {
      trialName,
      isActive: true,
      startDate,
      endDate
    });
    
    return { ok: true };
  },
  
  enrollParticipant(participantId, trialId) {
    const trial = this.getTrial(trialId);
    if (!trial) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    if (!trial.isActive) {
      return { err: this.ERR_TRIAL_INACTIVE };
    }
    
    if (this.getParticipant(participantId)) {
      return { err: this.ERR_ALREADY_ENROLLED };
    }
    
    const key = JSON.stringify({ participantId });
    this.participants.set(key, {
      principalId: this.txSender,
      consentProvided: false,
      eligibilityStatus: false,
      enrollmentDate: this.blockHeight,
      trialId
    });
    
    return { ok: true };
  },
  
  provideConsent(participantId) {
    const participant = this.getParticipant(participantId);
    if (!participant) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    if (this.txSender !== participant.principalId) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const key = JSON.stringify({ participantId });
    this.participants.set(key, {
      ...participant,
      consentProvided: true
    });
    
    return { ok: true };
  },
  
  setEligibility(participantId, isEligible) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const participant = this.getParticipant(participantId);
    if (!participant) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    const key = JSON.stringify({ participantId });
    this.participants.set(key, {
      ...participant,
      eligibilityStatus: isEligible
    });
    
    return { ok: true };
  },
  
  setAdmin(newAdmin) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    this.admin = newAdmin;
    return { ok: true };
  }
};

describe('Patient Enrollment Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.participants = new Map();
    mockContract.trials = new Map();
    mockContract.admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.blockHeight = 100;
  });
  
  describe('registerTrial', () => {
    it('should allow admin to register a trial', () => {
      const result = mockContract.registerTrial(
          'trial-123',
          'Diabetes Study',
          1000,
          2000
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getTrial('trial-123')).toEqual({
        trialName: 'Diabetes Study',
        isActive: true,
        startDate: 1000,
        endDate: 2000
      });
    });
    
    it('should not allow non-admin to register a trial', () => {
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.registerTrial(
          'trial-123',
          'Diabetes Study',
          1000,
          2000
      );
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
  
  describe('enrollParticipant', () => {
    beforeEach(() => {
      // Register a trial first
      mockContract.registerTrial(
          'trial-123',
          'Diabetes Study',
          1000,
          2000
      );
      
      // Set a non-admin user as tx-sender
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    });
    
    it('should allow a participant to enroll in a trial', () => {
      const result = mockContract.enrollParticipant('participant-123', 'trial-123');
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getParticipant('participant-123')).toEqual({
        principalId: 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        consentProvided: false,
        eligibilityStatus: false,
        enrollmentDate: 100,
        trialId: 'trial-123'
      });
    });
    
    it('should not allow enrollment in a non-existent trial', () => {
      const result = mockContract.enrollParticipant('participant-123', 'non-existent-trial');
      
      expect(result).toEqual({ err: mockContract.ERR_NOT_FOUND });
    });
    
    it('should not allow duplicate enrollment', () => {
      // First enrollment
      mockContract.enrollParticipant('participant-123', 'trial-123');
      
      // Attempt duplicate enrollment
      const result = mockContract.enrollParticipant('participant-123', 'trial-123');
      
      expect(result).toEqual({ err: mockContract.ERR_ALREADY_ENROLLED });
    });
  });
  
  describe('provideConsent', () => {
    beforeEach(() => {
      // Register a trial
      mockContract.registerTrial('trial-123', 'Diabetes Study', 1000, 2000);
      
      // Set a participant as tx-sender
      const participantAddress = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      mockContract.setTxSender(participantAddress);
      
      // Enroll the participant
      mockContract.enrollParticipant('participant-123', 'trial-123');
    });
    
    it('should allow a participant to provide consent', () => {
      const result = mockContract.provideConsent('participant-123');
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getParticipant('participant-123').consentProvided).toBe(true);
    });
    
    it('should not allow another user to provide consent for a participant', () => {
      // Change tx-sender to a different user
      mockContract.setTxSender('ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.provideConsent('participant-123');
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
  
  describe('setEligibility', () => {
    beforeEach(() => {
      // Register a trial
      mockContract.registerTrial('trial-123', 'Diabetes Study', 1000, 2000);
      
      // Set a participant as tx-sender
      const participantAddress = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      mockContract.setTxSender(participantAddress);
      
      // Enroll the participant
      mockContract.enrollParticipant('participant-123', 'trial-123');
      
      // Set tx-sender back to admin
      mockContract.setTxSender('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    });
    
    it('should allow admin to set eligibility', () => {
      const result = mockContract.setEligibility('participant-123', true);
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getParticipant('participant-123').eligibilityStatus).toBe(true);
    });
    
    it('should not allow non-admin to set eligibility', () => {
      // Set tx-sender to non-admin
      mockContract.setTxSender('ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.setEligibility('participant-123', true);
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
});
