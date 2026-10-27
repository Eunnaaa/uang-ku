import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Unified Financial Planning (Kantong Finansial):
 * Goals / Target Impian has been consolidated into Saving Pockets at `/pockets`.
 */
export default function GoalsScreen() {
  return <Redirect href="/pockets" />;
}
