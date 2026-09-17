export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          country: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          region: string | null
          status: Database["public"]["Enums"]["project_status"]
          total_area_hectares: number
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name: string
          project_type?: Database["public"]["Enums"]["project_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_area_hectares?: number
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_area_hectares?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_metrics: {
        Row: {
          biodiversity_index: number
          carbon_sequestered: number
          created_at: string
          forest_cover_percentage: number
          id: string
          project_health_score: number
          recorded_at: string
          site_id: string
          species_count: number
          water_quality_index: number
        }
        Insert: {
          biodiversity_index?: number
          carbon_sequestered?: number
          created_at?: string
          forest_cover_percentage?: number
          id?: string
          project_health_score?: number
          recorded_at?: string
          site_id: string
          species_count?: number
          water_quality_index?: number
        }
        Update: {
          biodiversity_index?: number
          carbon_sequestered?: number
          created_at?: string
          forest_cover_percentage?: number
          id?: string
          project_health_score?: number
          recorded_at?: string
          site_id?: string
          species_count?: number
          water_quality_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          area_hectares: number
          centroid: unknown
          created_at: string
          description: string | null
          geom: unknown
          id: string
          name: string
          project_id: string
          status: Database["public"]["Enums"]["site_status"]
          updated_at: string
        }
        Insert: {
          area_hectares?: number
          centroid?: unknown
          created_at?: string
          description?: string | null
          geom: unknown
          id?: string
          name: string
          project_id: string
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
        }
        Update: {
          area_hectares?: number
          centroid?: unknown
          created_at?: string
          description?: string | null
          geom?: unknown
          id?: string
          name?: string
          project_id?: string
          status?: Database["public"]["Enums"]["site_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      sites_geo: {
        Row: {
          area_hectares: number | null
          centroid_lat: number | null
          centroid_lng: number | null
          country: string | null
          created_at: string | null
          description: string | null
          geometry: Json | null
          id: string | null
          name: string | null
          project_id: string | null
          project_name: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          region: string | null
          status: Database["public"]["Enums"]["site_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_site: {
        Args: {
          p_description: string
          p_geojson: Json
          p_name: string
          p_project_id: string
          p_status: Database["public"]["Enums"]["site_status"]
        }
        Returns: string
      }
      demo_polygon: {
        Args: { lat: number; lng: number; radius_km: number; seed: number }
        Returns: unknown
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_demo_data: { Args: never; Returns: number }
      update_site: {
        Args: {
          p_description?: string
          p_geojson?: Json
          p_name?: string
          p_site_id: string
          p_status?: Database["public"]["Enums"]["site_status"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "member"
      project_status: "planning" | "active" | "completed" | "archived"
      project_type: "carbon" | "biodiversity" | "carbon_and_biodiversity"
      site_status:
        | "planning"
        | "active"
        | "monitoring"
        | "completed"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
      project_status: ["planning", "active", "completed", "archived"],
      project_type: ["carbon", "biodiversity", "carbon_and_biodiversity"],
      site_status: [
        "planning",
        "active",
        "monitoring",
        "completed",
        "archived",
      ],
    },
  },
} as const
