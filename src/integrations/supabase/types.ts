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
      gestor_oficinas: {
        Row: {
          criado_em: string
          id: string
          oficina_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          oficina_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          oficina_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestor_oficinas_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestor_oficinas_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas_com_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      inscricoes: {
        Row: {
          cpf: string
          criado_em: string
          id: string
          nome: string
          oficina_quinta_id: string
          oficina_sexta_id: string
          pessoa_id: string | null
          protocolo: string
        }
        Insert: {
          cpf: string
          criado_em?: string
          id?: string
          nome: string
          oficina_quinta_id: string
          oficina_sexta_id: string
          pessoa_id?: string | null
          protocolo: string
        }
        Update: {
          cpf?: string
          criado_em?: string
          id?: string
          nome?: string
          oficina_quinta_id?: string
          oficina_sexta_id?: string
          pessoa_id?: string | null
          protocolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_oficina_quinta_id_fkey"
            columns: ["oficina_quinta_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_oficina_quinta_id_fkey"
            columns: ["oficina_quinta_id"]
            isOneToOne: false
            referencedRelation: "oficinas_com_vagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_oficina_sexta_id_fkey"
            columns: ["oficina_sexta_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_oficina_sexta_id_fkey"
            columns: ["oficina_sexta_id"]
            isOneToOne: false
            referencedRelation: "oficinas_com_vagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      oficinas: {
        Row: {
          ativa: boolean
          criado_em: string
          data: string
          dia: string
          id: string
          limite_vagas: number
          ministrante: string
          ordem: number
          publico_alvo: string | null
          titulo: string
        }
        Insert: {
          ativa?: boolean
          criado_em?: string
          data: string
          dia: string
          id?: string
          limite_vagas?: number
          ministrante: string
          ordem?: number
          publico_alvo?: string | null
          titulo: string
        }
        Update: {
          ativa?: boolean
          criado_em?: string
          data?: string
          dia?: string
          id?: string
          limite_vagas?: number
          ministrante?: string
          ordem?: number
          publico_alvo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      pessoas: {
        Row: {
          cpf: string
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          cpf: string
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          cpf?: string
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          inscricao_id: string
          manha: boolean
          oficina_id: string
          tarde: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          inscricao_id: string
          manha?: boolean
          oficina_id: string
          tarde?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          inscricao_id?: string
          manha?: boolean
          oficina_id?: string
          tarde?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "presencas_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas_com_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      oficinas_com_vagas: {
        Row: {
          ativa: boolean | null
          data: string | null
          dia: string | null
          id: string | null
          inscritos: number | null
          limite_vagas: number | null
          lotada: boolean | null
          ministrante: string | null
          ordem: number | null
          publico_alvo: string | null
          titulo: string | null
          vagas_disponiveis: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_atualizar_inscricao: {
        Args: {
          _inscricao_id: string
          _nome?: string
          _oficina_quinta: string
          _oficina_sexta: string
        }
        Returns: Json
      }
      admin_listar_gestores: {
        Args: never
        Returns: {
          email: string
          nome: string
          oficinas: Json
          user_id: string
        }[]
      }
      buscar_pessoa_por_cpf: {
        Args: { _cpf: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      confirmar_inscricao: {
        Args: {
          _cpf: string
          _nome: string
          _oficina_quinta: string
          _oficina_sexta: string
        }
        Returns: Json
      }
      consultar_inscricao_por_cpf: { Args: { _cpf: string }; Returns: Json }
      gerencia_oficina: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      listar_chamada: {
        Args: { _oficina_id: string }
        Returns: {
          cpf: string
          horas: number
          inscricao_id: string
          manha: boolean
          nome: string
          tarde: boolean
        }[]
      }
      listar_minhas_oficinas: {
        Args: never
        Returns: {
          chamadas_feitas: number
          data: string
          dia: string
          id: string
          limite_vagas: number
          ministrante: string
          pendentes: number
          publico_alvo: string
          titulo: string
          total_inscritos: number
        }[]
      }
      listar_participantes_publico: {
        Args: never
        Returns: {
          data: string
          dia: string
          horas: number
          manha: boolean
          ministrante: string
          nome: string
          oficina_id: string
          ordem: number
          publico_alvo: string
          tarde: boolean
          titulo: string
        }[]
      }
      marcar_presenca: {
        Args: {
          _inscricao_id: string
          _manha: boolean
          _oficina_id: string
          _tarde: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "gestor"
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
    Enums: {
      app_role: ["admin", "gestor"],
    },
  },
} as const
