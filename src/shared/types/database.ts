export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      battles: {
        Row: {
          campaign_node_id: string | null
          commitment_min_difficulty: number | null
          commitment_min_duration_minutes: number | null
          commitment_type: string
          created_at: string
          encounter_difficulty: number
          encounter_kind: string
          focus_session_id: string | null
          id: string
          owner_id: string
          resolved_at: string | null
          result: string | null
          status: string
          task_id: string | null
          team_multiplier_applied: number | null
          wild_species_pokedex_number: number | null
        }
        Insert: {
          campaign_node_id?: string | null
          commitment_min_difficulty?: number | null
          commitment_min_duration_minutes?: number | null
          commitment_type: string
          created_at?: string
          encounter_difficulty: number
          encounter_kind: string
          focus_session_id?: string | null
          id?: string
          owner_id: string
          resolved_at?: string | null
          result?: string | null
          status?: string
          task_id?: string | null
          team_multiplier_applied?: number | null
          wild_species_pokedex_number?: number | null
        }
        Update: {
          campaign_node_id?: string | null
          commitment_min_difficulty?: number | null
          commitment_min_duration_minutes?: number | null
          commitment_type?: string
          created_at?: string
          encounter_difficulty?: number
          encounter_kind?: string
          focus_session_id?: string | null
          id?: string
          owner_id?: string
          resolved_at?: string | null
          result?: string | null
          status?: string
          task_id?: string | null
          team_multiplier_applied?: number | null
          wild_species_pokedex_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'battles_campaign_node_id_fkey'
            columns: ['campaign_node_id']
            isOneToOne: false
            referencedRelation: 'campaign_nodes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'battles_focus_session_id_fkey'
            columns: ['focus_session_id']
            isOneToOne: false
            referencedRelation: 'focus_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'battles_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'battles_wild_species_pokedex_number_fkey'
            columns: ['wild_species_pokedex_number']
            isOneToOne: false
            referencedRelation: 'species_catalog'
            referencedColumns: ['pokedex_number']
          },
        ]
      }
      campaign_node_prerequisites: {
        Row: {
          node_id: string
          requires_node_id: string
        }
        Insert: {
          node_id: string
          requires_node_id: string
        }
        Update: {
          node_id?: string
          requires_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_node_prerequisites_node_id_fkey'
            columns: ['node_id']
            isOneToOne: false
            referencedRelation: 'campaign_nodes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'campaign_node_prerequisites_requires_node_id_fkey'
            columns: ['requires_node_id']
            isOneToOne: false
            referencedRelation: 'campaign_nodes'
            referencedColumns: ['id']
          },
        ]
      }
      campaign_node_progress: {
        Row: {
          completed_at: string | null
          node_id: string
          owner_id: string
          victories: number
        }
        Insert: {
          completed_at?: string | null
          node_id: string
          owner_id: string
          victories?: number
        }
        Update: {
          completed_at?: string | null
          node_id?: string
          owner_id?: string
          victories?: number
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_node_progress_node_id_fkey'
            columns: ['node_id']
            isOneToOne: false
            referencedRelation: 'campaign_nodes'
            referencedColumns: ['id']
          },
        ]
      }
      campaign_nodes: {
        Row: {
          encounter_difficulty: number
          encounter_kind: string
          id: string
          kind: string
          npc_name: string | null
          region_id: string
          repeatable: boolean
          required_victories: number
          sort_order: number
          summary: string
          title: string
        }
        Insert: {
          encounter_difficulty: number
          encounter_kind: string
          id: string
          kind: string
          npc_name?: string | null
          region_id: string
          repeatable?: boolean
          required_victories: number
          sort_order: number
          summary: string
          title: string
        }
        Update: {
          encounter_difficulty?: number
          encounter_kind?: string
          id?: string
          kind?: string
          npc_name?: string | null
          region_id?: string
          repeatable?: boolean
          required_victories?: number
          sort_order?: number
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_nodes_region_id_fkey'
            columns: ['region_id']
            isOneToOne: false
            referencedRelation: 'campaign_regions'
            referencedColumns: ['id']
          },
        ]
      }
      campaign_regions: {
        Row: {
          content_version: number
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          content_version?: number
          id: string
          name: string
          sort_order: number
        }
        Update: {
          content_version?: number
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      captures: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          owned_pokemon_id: string | null
          owner_id: string
          pokedex_number: number
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          owned_pokemon_id?: string | null
          owner_id: string
          pokedex_number: number
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          owned_pokemon_id?: string | null
          owner_id?: string
          pokedex_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'captures_battle_id_fkey'
            columns: ['battle_id']
            isOneToOne: true
            referencedRelation: 'battles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'captures_owned_pokemon_id_fkey'
            columns: ['owned_pokemon_id']
            isOneToOne: false
            referencedRelation: 'owned_pokemon'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'captures_pokedex_number_fkey'
            columns: ['pokedex_number']
            isOneToOne: false
            referencedRelation: 'species_catalog'
            referencedColumns: ['pokedex_number']
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          accumulated_pause_seconds: number
          created_at: string
          ended_at: string | null
          id: string
          owner_id: string
          paused_at: string | null
          planned_duration_seconds: number
          started_at: string
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          accumulated_pause_seconds?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_id: string
          paused_at?: string | null
          planned_duration_seconds: number
          started_at?: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_pause_seconds?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_id?: string
          paused_at?: string | null
          planned_duration_seconds?: number
          started_at?: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'focus_sessions_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      owned_pokemon: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          level: number
          nickname: string | null
          owner_id: string
          party_position: number | null
          pending_evolution_to_pokedex_number: number | null
          pokedex_number: number
          updated_at: string
          xp: number
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          level?: number
          nickname?: string | null
          owner_id: string
          party_position?: number | null
          pending_evolution_to_pokedex_number?: number | null
          pokedex_number: number
          updated_at?: string
          xp?: number
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          level?: number
          nickname?: string | null
          owner_id?: string
          party_position?: number | null
          pending_evolution_to_pokedex_number?: number | null
          pokedex_number?: number
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: 'owned_pokemon_pending_evolution_to_pokedex_number_fkey'
            columns: ['pending_evolution_to_pokedex_number']
            isOneToOne: false
            referencedRelation: 'species_catalog'
            referencedColumns: ['pokedex_number']
          },
          {
            foreignKeyName: 'owned_pokemon_pokedex_number_fkey'
            columns: ['pokedex_number']
            isOneToOne: false
            referencedRelation: 'species_catalog'
            referencedColumns: ['pokedex_number']
          },
        ]
      }
      productivity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          owner_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          occurred_at: string
          owner_id: string
          source_id: string
          source_type: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          owner_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          owner_id: string
          reward_type: string
          source_id: string
          source_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          owner_id: string
          reward_type?: string
          source_id: string
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          owner_id?: string
          reward_type?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      species_catalog: {
        Row: {
          catalog_version: number
          evolution_min_level: number | null
          evolves_to_pokedex_number: number | null
          imported_at: string
          is_starter: boolean
          name: string
          official_artwork_url: string | null
          pokedex_number: number
          sprite_url: string | null
          types: string[]
        }
        Insert: {
          catalog_version?: number
          evolution_min_level?: number | null
          evolves_to_pokedex_number?: number | null
          imported_at?: string
          is_starter?: boolean
          name: string
          official_artwork_url?: string | null
          pokedex_number: number
          sprite_url?: string | null
          types: string[]
        }
        Update: {
          catalog_version?: number
          evolution_min_level?: number | null
          evolves_to_pokedex_number?: number | null
          imported_at?: string
          is_starter?: boolean
          name?: string
          official_artwork_url?: string | null
          pokedex_number?: number
          sprite_url?: string | null
          types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: 'species_catalog_evolves_to_pokedex_number_fkey'
            columns: ['evolves_to_pokedex_number']
            isOneToOne: false
            referencedRelation: 'species_catalog'
            referencedColumns: ['pokedex_number']
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          difficulty: number
          due_date: string | null
          id: string
          owner_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_date?: string | null
          id?: string
          owner_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          due_date?: string | null
          id?: string
          owner_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      capture_from_battle: {
        Args: { p_battle_id: string }
        Returns: {
          captured_at: string
          created_at: string
          id: string
          level: number
          nickname: string | null
          owner_id: string
          party_position: number | null
          pending_evolution_to_pokedex_number: number | null
          pokedex_number: number
          updated_at: string
          xp: number
        }
        SetofOptions: {
          from: '*'
          to: 'owned_pokemon'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_evolution: {
        Args: { p_owned_pokemon_id: string }
        Returns: {
          captured_at: string
          created_at: string
          id: string
          level: number
          nickname: string | null
          owner_id: string
          party_position: number | null
          pending_evolution_to_pokedex_number: number | null
          pokedex_number: number
          updated_at: string
          xp: number
        }
        SetofOptions: {
          from: '*'
          to: 'owned_pokemon'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_pending_battle: {
        Args: {
          p_focus_session_id: string
          p_fulfillment_difficulty: number
          p_fulfillment_minutes: number
          p_owner_id: string
          p_task_id: string
        }
        Returns: undefined
      }
      swap_party_positions: {
        Args: { p_pokemon_a: string; p_pokemon_b: string }
        Returns: undefined
      }
      total_xp_for_level: { Args: { p_level: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
