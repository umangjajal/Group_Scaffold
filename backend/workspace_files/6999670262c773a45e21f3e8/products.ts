import { Router } from 'express';
import { createProduct, updateProduct, deleteProduct } from '../controllers/products';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.post('/', requireAuth('SHOPKEEPER'), createProduct);
router.put('/:id', requireAuth('SHOPKEEPER'), updateProduct);
router.delete('/:id', requireAuth('SHOPKEEPER'), deleteProduct);

export default router;
