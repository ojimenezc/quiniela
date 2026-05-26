require "json"
require "time"

source_path = ARGV.fetch(0)
target_path = ARGV.fetch(1)
data = JSON.parse(File.read(source_path))

def sql_value(value)
  return "null" if value.nil?
  return value.to_s if value.is_a?(Integer)

  "'#{value.to_s.gsub("'", "''")}'"
end

TEAM_NAMES = {
  "Mexico" => "México",
  "South Africa" => "Sudáfrica",
  "South Korea" => "Corea del Sur",
  "Czech Republic" => "República Checa",
  "Canada" => "Canadá",
  "Bosnia & Herzegovina" => "Bosnia y Herzegovina",
  "Qatar" => "Catar",
  "Switzerland" => "Suiza",
  "Brazil" => "Brasil",
  "Morocco" => "Marruecos",
  "Haiti" => "Haití",
  "Scotland" => "Escocia",
  "USA" => "Estados Unidos",
  "Turkey" => "Turquía",
  "Germany" => "Alemania",
  "Curaçao" => "Curazao",
  "Ivory Coast" => "Costa de Marfil",
  "Netherlands" => "Países Bajos",
  "Japan" => "Japón",
  "Sweden" => "Suecia",
  "Tunisia" => "Túnez",
  "Belgium" => "Bélgica",
  "Egypt" => "Egipto",
  "Iran" => "Irán",
  "New Zealand" => "Nueva Zelanda",
  "Spain" => "España",
  "Cape Verde" => "Cabo Verde",
  "Saudi Arabia" => "Arabia Saudita",
  "France" => "Francia",
  "Iraq" => "Irak",
  "Norway" => "Noruega",
  "Algeria" => "Argelia",
  "Jordan" => "Jordania",
  "DR Congo" => "RD Congo",
  "Uzbekistan" => "Uzbekistán",
  "England" => "Inglaterra",
  "Croatia" => "Croacia",
  "Panama" => "Panamá",
}.freeze

STAGE_NAMES = {
  "Matchday 1" => "Jornada 1",
  "Matchday 2" => "Jornada 2",
  "Matchday 3" => "Jornada 3",
  "Matchday 4" => "Jornada 4",
  "Matchday 5" => "Jornada 5",
  "Matchday 6" => "Jornada 6",
  "Matchday 7" => "Jornada 7",
  "Matchday 8" => "Jornada 8",
  "Matchday 9" => "Jornada 9",
  "Matchday 10" => "Jornada 10",
  "Matchday 11" => "Jornada 11",
  "Matchday 12" => "Jornada 12",
  "Matchday 13" => "Jornada 13",
  "Matchday 14" => "Jornada 14",
  "Matchday 15" => "Jornada 15",
  "Matchday 16" => "Jornada 16",
  "Matchday 17" => "Jornada 17",
  "Round of 32" => "Dieciseisavos de final",
  "Round of 16" => "Octavos de final",
  "Quarter-final" => "Cuartos de final",
  "Semi-final" => "Semifinal",
  "Match for third place" => "Partido por tercer lugar",
}.freeze

def translate_team(value)
  return "Ganador #{Regexp.last_match(1)}" if value =~ /\AW(\d+)\z/
  return "Perdedor #{Regexp.last_match(1)}" if value =~ /\AL(\d+)\z/
  return "#{$1}.º Grupo #{$2}" if value =~ /\A([123])([A-L])\z/
  return "3.º Grupo #{value.delete_prefix("3")}" if value.start_with?("3")

  TEAM_NAMES.fetch(value, value)
end

File.open(target_path, "w") do |file|
  file.puts "-- Limpia datos de prueba y carga los 104 partidos del Mundial 2026."
  file.puts "-- Fuente: openfootball/worldcup.json 2026, CC0-1.0."
  file.puts
  file.puts "delete from predictions;"
  file.puts "delete from matches;"
  file.puts "-- Si ya tienes participantes reales, comenta la siguiente línea antes de correr este script."
  file.puts "delete from participants;"
  file.puts
  file.puts "alter table matches add column if not exists venue text;"
  file.puts "alter table matches add column if not exists match_number integer;"
  file.puts
  file.puts "insert into matches (match_number, stage, group_name, home_team, away_team, starts_at, venue, status)"
  file.puts "values"

  rows = data.fetch("matches").each_with_index.map do |match, index|
    time = match.fetch("time")
    kickoff_time = time.split.first
    offset = format("%+03d:00", time[/UTC([+-]\d+)/, 1].to_i)
    starts_at = Time.strptime(
      "#{match.fetch("date")} #{kickoff_time} #{offset}",
      "%Y-%m-%d %H:%M %z",
    ).utc.iso8601

    values = [
      match["num"] || index + 1,
      STAGE_NAMES.fetch(match.fetch("round"), match.fetch("round")),
      match["group"]&.sub("Group ", ""),
      translate_team(match.fetch("team1")),
      translate_team(match.fetch("team2")),
      starts_at,
      match.fetch("ground"),
      "scheduled",
    ]

    "  (#{values.map { |value| sql_value(value) }.join(", ")})"
  end

  file.puts "#{rows.join(",\n")};"
  file.puts
  file.puts "insert into participants (name, pin, is_admin)"
  file.puts "values ('Admin', '0000', true)"
  file.puts "on conflict (name) do update set is_admin = true;"
end
