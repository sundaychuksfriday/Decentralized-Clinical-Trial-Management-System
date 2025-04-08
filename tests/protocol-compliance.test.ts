import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  protocolSteps: new Map(),
  participantCompliance: new Map(),
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Example admin address
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Start with admin as sender
  blockHeight: 100,
  
  // Constants
  ERR_UNAUTHORIZED: 1,
  ERR_NOT_FOUND: 4,
  ERR_INVALID_STEP: 5,
  
  // Helper to set tx-sender for testing
  setTxSender(address) {
    this.txSender = address;
  },
  
  // Contract functions
  isAdmin() {
    return this.txSender === this.admin;
  },
  
  getProtocolStep(trialId, stepId) {
    const key = JSON.stringify({ trialId, stepId });
    return this.protocolSteps.has(key) ? this.protocolSteps.get(key) : null;
  },
  
  getParticipantCompliance(participantId, stepId) {
    const key = JSON.stringify({ participantId, stepId });
    return this.participantCompliance.has(key) ? this.participantCompliance.get(key) : null;
  },
  
  addProtocolStep(trialId, stepId, stepName, required, sequenceOrder, timeWindow) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const key = JSON.stringify({ trialId, stepId });
    this.protocolSteps.set(key, {
      stepName,
      required,
      sequenceOrder,
      timeWindow
    });
    
    return { ok: true };
  },
  
  recordStepCompletion(participantId, trialId, stepId, notes) {
    const step = this.getProtocolStep(trialId, stepId);
    if (!step) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    const key = JSON.stringify({ participantId, stepId });
    this.participantCompliance.set(key, {
      completed: true,
      completionDate: this.blockHeight,
      verifiedBy: null,
      notes
    });
    
    return { ok: true };
  },
  
  verifyStepCompletion(participantId, stepId) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const compliance = this.getParticipantCompliance(participantId, stepId);
    if (!compliance) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    if (!compliance.completed) {
      return { err: this.ERR_INVALID_STEP };
    }
    
    const key = JSON.stringify({ participantId, stepId });
    this.participantCompliance.set(key, {
      ...compliance,
      verifiedBy: this.txSender
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

describe('Protocol Compliance Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.protocolSteps = new Map();
    mockContract.participantCompliance = new Map();
    mockContract.admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.blockHeight = 100;
  });
  
  describe('addProtocolStep', () => {
    it('should allow admin to add a protocol step', () => {
      const result = mockContract.addProtocolStep(
          'trial-123',
          'step-1',
          'Initial Assessment',
          true,
          1,
          7
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getProtocolStep('trial-123', 'step-1')).toEqual({
        stepName: 'Initial Assessment',
        required: true,
        sequenceOrder: 1,
        timeWindow: 7
      });
    });
    
    it('should not allow non-admin to add a protocol step', () => {
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.addProtocolStep(
          'trial-123',
          'step-1',
          'Initial Assessment',
          true,
          1,
          7
      );
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
  
  describe('recordStepCompletion', () => {
    beforeEach(() => {
      // Add a protocol step first
      mockContract.addProtocolStep(
          'trial-123',
          'step-1',
          'Initial Assessment',
          true,
          1,
          7
      );
      
      // Set a participant as tx-sender
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    });
    
    it('should allow recording step completion', () => {
      const result = mockContract.recordStepCompletion(
          'participant-123',
          'trial-123',
          'step-1',
          'Completed successfully'
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getParticipantCompliance('participant-123', 'step-1')).toEqual({
        completed: true,
        completionDate: 100,
        verifiedBy: null,
        notes: 'Completed successfully'
      });
    });
    
    it('should not allow recording completion for non-existent step', () => {
      const result = mockContract.recordStepCompletion(
          'participant-123',
          'trial-123',
          'non-existent-step',
          'Completed successfully'
      );
      
      expect(result).toEqual({ err: mockContract.ERR_NOT_FOUND });
    });
  });
  
  describe('verifyStepCompletion', () => {
    beforeEach(() => {
      // Add a protocol step
      mockContract.addProtocolStep(
          'trial-123',
          'step-1',
          'Initial Assessment',
          true,
          1,
          7
      );
      
      // Set a participant as tx-sender
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      // Record step completion
      mockContract.recordStepCompletion(
          'participant-123',
          'trial-123',
          'step-1',
          'Completed successfully'
      );
      
      // Set tx-sender back to admin
      mockContract.setTxSender('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    });
    
    it('should allow admin to verify step completion', () => {
      const result = mockContract.verifyStepCompletion('participant-123', 'step-1');
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getParticipantCompliance('participant-123', 'step-1').verifiedBy).toBe(
          'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
      );
    });
    
    it('should not allow non-admin to verify step completion', () => {
      mockContract.setTxSender('ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.verifyStepCompletion('participant-123', 'step-1');
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
});
