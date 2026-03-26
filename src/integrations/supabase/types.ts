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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_configurations: {
        Row: {
          alertaki_senha: string | null
          alertaki_usuario: string | null
          created_at: string
          escavador_api_key: string | null
          escavador_endpoint: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alertaki_senha?: string | null
          alertaki_usuario?: string | null
          created_at?: string
          escavador_api_key?: string | null
          escavador_endpoint?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alertaki_senha?: string | null
          alertaki_usuario?: string | null
          created_at?: string
          escavador_api_key?: string | null
          escavador_endpoint?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          precatorio_id: string
          sender: string
          user_id: string
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          id?: string
          precatorio_id: string
          sender: string
          user_id: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          precatorio_id?: string
          sender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_precatorio_id_fkey"
            columns: ["precatorio_id"]
            isOneToOne: false
            referencedRelation: "precatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      evachat_contacts: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          instance_id: string
          last_message: string | null
          last_timestamp: string | null
          nome: string | null
          numero: string | null
          status: string
          updated_at: string | null
          user_id: string
          wa_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          instance_id: string
          last_message?: string | null
          last_timestamp?: string | null
          nome?: string | null
          numero?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          wa_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string
          last_message?: string | null
          last_timestamp?: string | null
          nome?: string | null
          numero?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evachat_contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evachat_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      evachat_instances: {
        Row: {
          created_at: string | null
          id: string
          name: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      evachat_messages: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          sender: string
          text: string
          timestamp: string | null
          user_id: string
          wa_message_id: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          sender: string
          text: string
          timestamp?: string | null
          user_id: string
          wa_message_id?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          sender?: string
          text?: string
          timestamp?: string | null
          user_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evachat_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "evachat_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      naturezas: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      kanban_boards: {
        Row: {
          created_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      kanban_columns: {
        Row: {
          board_id: string
          created_at: string | null
          id: string
          order_index: number
          title: string
        }
        Insert: {
          board_id: string
          created_at?: string | null
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          board_id?: string
          created_at?: string | null
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      precatorios: {
        Row: {
          ano: number
          cpf: string | null
          created_at: string
          emails: string[] | null
          erro_mensagem: string | null
          escavador_dados: Json | null
          id: string
          kanban_board_id: string | null
          kanban_column_id: string | null
          kanban_coluna: string
          nome_titular: string | null
          numero: string
          status: string
          natureza: string | null
          natureza_id: string | null
          telefones: string[] | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ano?: number
          cpf?: string | null
          created_at?: string
          emails?: string[] | null
          erro_mensagem?: string | null
          escavador_dados?: Json | null
          id?: string
          kanban_board_id?: string | null
          kanban_column_id?: string | null
          kanban_coluna?: string
          nome_titular?: string | null
          numero: string
          status?: string
          natureza?: string | null
          natureza_id?: string | null
          telefones?: string[] | null
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          ano?: number
          cpf?: string | null
          created_at?: string
          emails?: string[] | null
          erro_mensagem?: string | null
          escavador_dados?: Json | null
          id?: string
          kanban_board_id?: string | null
          kanban_column_id?: string | null
          kanban_coluna?: string
          nome_titular?: string | null
          numero?: string
          status?: string
          natureza?: string | null
          natureza_id?: string | null
          telefones?: string[] | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "precatorios_kanban_board_id_fkey"
            columns: ["kanban_board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precatorios_kanban_column_id_fkey"
            columns: ["kanban_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precatorios_natureza_id_fkey"
            columns: ["natureza_id"]
            isOneToOne: false
            referencedRelation: "naturezas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
