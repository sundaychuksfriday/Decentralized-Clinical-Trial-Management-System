import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  dataPoints: new Map(),
  dataTypes: new Map(),
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Example admin address
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Start with admin as sender
  blockHeight: 100,
  
  // Constants
  ERR_UNAUTHORIZED: 1,
  ERR_NOT_FOUND: 4,
  ERR_INVALID_DATA: 6,
  
  // Helper to set tx-sender for testing
  setTxSender(address) {
    this.txSender = address;
  },
  
  // Contract functions
  isAdmin() {
    return this.txSender === this.admin;
  },
  
  getDataPoint(participantId, dataPointId) {
    const key = JSON.stringify({ participantId, dataPointId });
    return this.dataPoints.has(key) ? this.dataPoints.get(key) : null;
  },
  
  getDataType(typeId) {
    const key = JSON.stringify({ typeId });
    return this.dataTypes.has(key) ? this.dataTypes.get(key) : null;
  },
  
  registerDataType(typeId, typeName, format, units, validationRules) {
    if (!this.isAdmin()) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const key = JSON.stringify({ typeId });
    this.dataTypes.set(key, {
      typeName,
      format,
      units,
      validationRules
    });
    
    return { ok: true };
  },
  
  recordDataPoint(participantId, dataPointId, dataType, value, trialId, dataHash) {
    const type = this.getDataType(dataType);
    if (!type) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    const key = JSON.stringify({ participantId, dataPointId });
    this.dataPoints.set(key, {
      dataType,
      value,
      collectionDate: this.blockHeight,
      collectedBy: this.txSender,
      trialId,
      dataHash
    });
    
    return { ok: true };
  },
  
  updateDataPoint(participantId, dataPointId, value, dataHash) {
    const dataPoint = this.getDataPoint(participantId, dataPointId);
    if (!dataPoint) {
      return { err: this.ERR_NOT_FOUND };
    }
    
    if (this.txSender !== dataPoint.collectedBy) {
      return { err: this.ERR_UNAUTHORIZED };
    }
    
    const key = JSON.stringify({ participantId, dataPointId });
    this.dataPoints.set(key, {
      ...dataPoint,
      value,
      dataHash
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

describe('Data Collection Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.dataPoints = new Map();
    mockContract.dataTypes = new Map();
    mockContract.admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.blockHeight = 100;
  });
  
  describe('registerDataType', () => {
    it('should allow admin to register a data type', () => {
      const result = mockContract.registerDataType(
          'blood-pressure',
          'Blood Pressure',
          'numeric',
          'mmHg',
          'systolic/diastolic'
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getDataType('blood-pressure')).toEqual({
        typeName: 'Blood Pressure',
        format: 'numeric',
        units: 'mmHg',
        validationRules: 'systolic/diastolic'
      });
    });
    
    it('should not allow non-admin to register a data type', () => {
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const result = mockContract.registerDataType(
          'blood-pressure',
          'Blood Pressure',
          'numeric',
          'mmHg',
          'systolic/diastolic'
      );
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
  
  describe('recordDataPoint', () => {
    beforeEach(() => {
      // Register a data type first
      mockContract.registerDataType(
          'blood-pressure',
          'Blood Pressure',
          'numeric',
          'mmHg',
          'systolic/diastolic'
      );
      
      // Set a researcher as tx-sender
      mockContract.setTxSender('ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    });
    
    it('should allow recording a data point', () => {
      const dataHash = new Uint8Array(32).fill(1); // Mock hash
      
      const result = mockContract.recordDataPoint(
          'participant-123',
          'data-point-1',
          'blood-pressure',
          '120/80',
          'trial-123',
          dataHash
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getDataPoint('participant-123', 'data-point-1')).toEqual({
        dataType: 'blood-pressure',
        value: '120/80',
        collectionDate: 100,
        collectedBy: 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        trialId: 'trial-123',
        dataHash
      });
    });
    
    it('should not allow recording a data point for non-existent data type', () => {
      const dataHash = new Uint8Array(32).fill(1); // Mock hash
      
      const result = mockContract.recordDataPoint(
          'participant-123',
          'data-point-1',
          'non-existent-type',
          '120/80',
          'trial-123',
          dataHash
      );
      
      expect(result).toEqual({ err: mockContract.ERR_NOT_FOUND });
    });
  });
  
  describe('updateDataPoint', () => {
    beforeEach(() => {
      // Register a data type
      mockContract.registerDataType(
          'blood-pressure',
          'Blood Pressure',
          'numeric',
          'mmHg',
          'systolic/diastolic'
      );
      
      // Set a researcher as tx-sender
      const researcherAddress = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      mockContract.setTxSender(researcherAddress);
      
      // Record a data point
      const dataHash = new Uint8Array(32).fill(1); // Mock hash
      mockContract.recordDataPoint(
          'participant-123',
          'data-point-1',
          'blood-pressure',
          '120/80',
          'trial-123',
          dataHash
      );
    });
    
    it('should allow the original collector to update a data point', () => {
      const newDataHash = new Uint8Array(32).fill(2); // New mock hash
      
      const result = mockContract.updateDataPoint(
          'participant-123',
          'data-point-1',
          '118/78',
          newDataHash
      );
      
      expect(result).toEqual({ ok: true });
      expect(mockContract.getDataPoint('participant-123', 'data-point-1').value).toBe('118/78');
      expect(mockContract.getDataPoint('participant-123', 'data-point-1').dataHash).toBe(newDataHash);
    });
    
    it('should not allow a different user to update a data point', () => {
      // Change tx-sender to a different user
      mockContract.setTxSender('ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      const newDataHash = new Uint8Array(32).fill(2); // New mock hash
      
      const result = mockContract.updateDataPoint(
          'participant-123',
          'data-point-1',
          '118/78',
          newDataHash
      );
      
      expect(result).toEqual({ err: mockContract.ERR_UNAUTHORIZED });
    });
  });
});
