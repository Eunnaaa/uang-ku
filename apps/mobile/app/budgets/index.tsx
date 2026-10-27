import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Unified Financial Planning (Kantong Finansial):
 * Budgeting has been consolidated into Spending Pockets at `/pockets`.
 */
export default function BudgetsScreen() {
  return <Redirect href="/pockets" />;
}
