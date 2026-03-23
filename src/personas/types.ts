/**
 * Persona type definitions for DomainKit persona-based skill generation.
 */

export interface PersonaSection {
  heading: string;
  prompt: string;
  required: boolean;
}

export interface PersonaDefinition {
  id: string;
  name: string;
  description: string;
  focusAreas: string[];
  sections: PersonaSection[];
  promptContext: string;
  priority: 'primary' | 'supplementary';
}
