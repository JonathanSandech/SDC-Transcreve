"""
TOON Parser - Converte formato TOON para JSON estruturado
SDC-Ata-Generator

ATUALIZADO: Parser flexível que aceita tanto {campo} quanto {{campo}}
"""

import re
import json
from typing import Dict, List, Any


class TOONParserError(Exception):
    """Exceção customizada para erros de parsing TOON"""
    pass


class TOONParser:
    """Parser para converter formato TOON em JSON estruturado"""

    def __init__(self):
        self.data = {}
        self.lines = []
        self.current_line = 0

    def parse(self, toon_string: str) -> Dict[str, Any]:
        """
        Parse uma string TOON e retorna um dicionário JSON estruturado

        Args:
            toon_string: String no formato TOON

        Returns:
            Dicionário com dados estruturados

        Raises:
            TOONParserError: Se o formato for inválido
        """
        if not toon_string or not toon_string.strip():
            raise TOONParserError("String TOON vazia ou inválida")

        # Normalizar entrada: garantir que \n seja quebra de linha real
        toon_string = toon_string.replace('\\n', '\n')

        # Dividir por linhas e remover linhas vazias
        self.lines = [line.strip() for line in toon_string.split('\n') if line.strip()]
        self.current_line = 0
        self.data = {}

        # Processar todas as linhas
        while self.current_line < len(self.lines):
            line = self.lines[self.current_line]

            if self._is_array_header(line):
                self._parse_array()
            elif self._is_simple_field(line):
                self._parse_simple_field()
            else:
                # Linha não reconhecida - pular
                self.current_line += 1

        # Validar campos obrigatórios
        self._validate_required_fields()

        return self.data

    def _is_simple_field(self, line: str) -> bool:
        """Verifica se a linha é um campo simples (key: value)"""
        # Não deve conter [ seguido de número e ] (indicador de array)
        if re.search(r'\[\d+\]', line):
            return False
        return ':' in line

    def _is_array_header(self, line: str) -> bool:
        """
        Verifica se a linha é cabeçalho de array
        
        Aceita AMBOS os formatos:
        - key[N]{fields}:   (chave simples)
        - key[N]{{fields}}: (chave dupla)
        """
        # Pattern flexível: aceita 1 ou mais chaves de abertura/fechamento
        pattern = r'^[a-zA-Z_]+\[\d+\]\{+[^}]+\}+:'
        return bool(re.match(pattern, line))

    def _parse_simple_field(self):
        """Parse um campo simples (key: value)"""
        line = self.lines[self.current_line]

        # Split apenas no primeiro ':'
        parts = line.split(':', 1)
        if len(parts) == 2:
            key = parts[0].strip()
            value = parts[1].strip()
            self.data[key] = value

        self.current_line += 1

    def _parse_array(self):
        """
        Parse um array estruturado
        
        Aceita AMBOS os formatos:
        - nome[N]{campo1,campo2,...}:   (chave simples)
        - nome[N]{{campo1,campo2,...}}: (chave dupla)
        """
        line = self.lines[self.current_line]

        # Extrair nome, quantidade e campos do cabeçalho
        # Pattern flexível: aceita 1 ou mais chaves
        match = re.match(r'^([a-zA-Z_]+)\[(\d+)\]\{+([^}]+)\}+:', line)

        if not match:
            raise TOONParserError(f"Formato de array inválido: {line}")

        array_name = match.group(1)
        count = int(match.group(2))
        fields_str = match.group(3)
        fields = [f.strip() for f in fields_str.split(',')]

        # Avançar para as linhas de dados
        self.current_line += 1

        # Parse das linhas de dados
        array_data = []
        items_found = 0
        
        while items_found < count and self.current_line < len(self.lines):
            data_line = self.lines[self.current_line]
            
            # Verificar se a linha parece ser dados (começa com número)
            if not re.match(r'^\d+,', data_line):
                # Se não começa com número, pode ser próximo header ou campo
                if self._is_array_header(data_line) or self._is_simple_field(data_line):
                    break
                # Linha estranha, pular
                self.current_line += 1
                continue

            # Parse da linha CSV - split limitado para preservar vírgulas no último campo
            values = [v.strip() for v in data_line.split(',', len(fields) - 1)]

            if len(values) != len(fields):
                raise TOONParserError(
                    f"Número de valores ({len(values)}) não corresponde ao número de campos ({len(fields)}) "
                    f"na linha {self.current_line + 1}: {data_line}"
                )

            # Criar objeto com campos mapeados
            obj = {fields[j]: values[j] for j in range(len(fields))}
            array_data.append(obj)
            items_found += 1

            self.current_line += 1

        if items_found < count:
            raise TOONParserError(
                f"Dados insuficientes para array '{array_name}'. Esperado {count}, encontrado {items_found}"
            )

        self.data[array_name] = array_data

    def _validate_required_fields(self):
        """Valida se todos os campos obrigatórios estão presentes"""
        required_fields = ['local', 'data_horario', 'convocado_por', 'objetivo']
        required_arrays = ['participantes', 'pontos', 'proximos_passos']

        missing_fields = []

        # Verificar campos simples
        for field in required_fields:
            if field not in self.data:
                missing_fields.append(field)

        # Verificar arrays
        for array in required_arrays:
            if array not in self.data or not isinstance(self.data[array], list) or len(self.data[array]) == 0:
                missing_fields.append(array)

        if missing_fields:
            raise TOONParserError(f"Campos obrigatórios faltando: {', '.join(missing_fields)}")


def parse_toon(toon_string: str) -> Dict[str, Any]:
    """
    Função utilitária para fazer parse de string TOON

    Args:
        toon_string: String no formato TOON

    Returns:
        Dicionário com dados estruturados
    """
    parser = TOONParser()
    return parser.parse(toon_string)


def toon_to_json_string(toon_string: str, indent: int = 2) -> str:
    """
    Converte string TOON diretamente para string JSON formatada

    Args:
        toon_string: String no formato TOON
        indent: Indentação do JSON (default: 2)

    Returns:
        String JSON formatada
    """
    data = parse_toon(toon_string)
    return json.dumps(data, ensure_ascii=False, indent=indent)


# Exemplo de uso e testes
if __name__ == '__main__':
    # Teste 1: Formato com chave SIMPLES (como o parser esperava antes)
    exemplo_chave_simples = """local: Sala de Reuniões SDC
data_horario: 13/11/2025 - 14:00
convocado_por: Jonathan Silva
objetivo: Demonstração de processo

participantes[3]{num,nome}:
1,Jonathan Silva
2,Everton Santos
3,Maria Costa

pontos[2]{item,topico}:
1,Primeiro ponto discutido com detalhes
2,Segundo ponto discutido com detalhes

proximos_passos[2]{item,acao,responsavel,data}:
1,Primeira ação,Jonathan Silva,20/11/2025
2,Segunda ação,Everton Santos,25/11/2025"""

    # Teste 2: Formato com chave DUPLA (como a IA às vezes gera)
    exemplo_chave_dupla = """local: Sala de Reuniões SDC
data_horario: 13/11/2025 - 14:00
convocado_por: Jonathan Silva
objetivo: Demonstração de processo

participantes[3]{{num,nome}}:
1,Jonathan Silva
2,Everton Santos
3,Maria Costa

pontos[2]{{item,topico}}:
1,Primeiro ponto discutido com detalhes
2,Segundo ponto discutido com detalhes

proximos_passos[2]{{item,acao,responsavel,data}}:
1,Primeira ação,Jonathan Silva,20/11/2025
2,Segunda ação,Everton Santos,25/11/2025"""

    print("=" * 60)
    print("TESTE 1: Chave Simples {campo}")
    print("=" * 60)
    try:
        resultado1 = parse_toon(exemplo_chave_simples)
        print("✅ Parse realizado com sucesso!")
        print(f"   Participantes: {len(resultado1['participantes'])}")
        print(f"   Pontos: {len(resultado1['pontos'])}")
        print(f"   Próximos passos: {len(resultado1['proximos_passos'])}")
    except TOONParserError as e:
        print(f"❌ Erro: {e}")

    print()
    print("=" * 60)
    print("TESTE 2: Chave Dupla {{campo}}")
    print("=" * 60)
    try:
        resultado2 = parse_toon(exemplo_chave_dupla)
        print("✅ Parse realizado com sucesso!")
        print(f"   Participantes: {len(resultado2['participantes'])}")
        print(f"   Pontos: {len(resultado2['pontos'])}")
        print(f"   Próximos passos: {len(resultado2['proximos_passos'])}")
    except TOONParserError as e:
        print(f"❌ Erro: {e}")

    print()
    print("=" * 60)
    print("JSON RESULTANTE (Teste 1):")
    print("=" * 60)
    print(json.dumps(resultado1, ensure_ascii=False, indent=2))