/**
 * @fileoverview Reiter der Agentensicht (geteilt von Panel und Reitern, die in einen anderen springen).
 *
 * @module components/library/agent-view
 */

export const AGENT_VIEW_TABS = ['aktuell', 'werkbank', 'baum', 'board', 'todos', 'sitzungen'] as const
export type AgentViewTab = (typeof AGENT_VIEW_TABS)[number]
