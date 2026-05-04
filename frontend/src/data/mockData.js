import { message } from 'antd';
import api from '../services/api';

export const mockData = {
  tools: [
    { id: 1, name: 'Drill', category_id: 1, quantity: 5, available: 3, location: 'Zone A' },
    { id: 2, name: 'Screwdriver Set', category_id: 1, quantity: 10, available: 7, location: 'Zone A' },
  ],
};