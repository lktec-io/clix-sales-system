import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as restaurantOrderService from '../services/restaurantOrder.service.js';

// The Kitchen screen — a read/update view over the same restaurant_orders
// data, gated by its own kitchen.view/kitchen.manage permissions instead of
// restaurant_orders.*, since kitchen staff don't need the cashier's
// order/payment permissions and vice versa.
export const queue = asyncHandler(async (req, res) => {
  const items = await restaurantOrderService.getKitchenQueue(req.user);
  return success(res, { data: items });
});

export const updateItemStatus = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.updateKitchenItemStatus(Number(req.params.itemId), req.body.kitchenStatus, req.user.tenantId);
  return success(res, { message: 'Item status updated', data: order });
});
