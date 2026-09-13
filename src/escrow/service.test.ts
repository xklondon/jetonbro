import { createEscrowService } from './service.js';
import { defineEscrowServiceTests } from './service.contract.js';

defineEscrowServiceTests('memory', () => createEscrowService());
