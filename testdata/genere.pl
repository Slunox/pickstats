#!/usr/bin/perl
# Génère testdata/club-test.json : une sauvegarde Pick&Stats complète pour un club de test
# (4 équipes, ~25 matchs avec actions saisies et feuilles e-Marque cohérentes).
# Lancer depuis le dossier du projet :  perl testdata/genere.pl
# Toujours les mêmes données (graine fixe) : changer SEED pour en obtenir d'autres.
use strict; use warnings; use utf8;
use JSON::PP;
use POSIX qw(floor);

my $SEED = 2026;
srand($SEED);

sub rnd { int(rand($_[0])) }                       # 0 .. n-1
sub between { $_[0] + rnd($_[1] - $_[0] + 1) }      # a .. b
sub pick { $_[rnd(scalar @_)] }
sub chance { rand() < $_[0] }
sub mmss { my $s = shift; sprintf('%02d:%02d', floor($s / 60), $s % 60) }
# Tirage pondéré : indice choisi selon les poids
sub wpick {
  my @w = @_; my $t = 0; $t += $_ for @w; my $r = rand($t);
  for my $i (0 .. $#w) { $r -= $w[$i]; return $i if $r < 0 }
  return $#w;
}

# --- Équipes du club ---
my @TEAMS = (
  { id => 'test-sm1', cat => 'Sénior', sex => 'M', suf => '1', color => '#1f7a4d', club => 'CLUB TEST PICKSTATS-1',
    players => [['4','Lucas Martin'],['5','Hugo Bernard'],['6','Nathan Petit'],['7','Théo Durand'],['8','Louis Moreau'],
      ['9','Adam Simon'],['10','Ethan Michel'],['11','Noah Lefèvre'],['12','Sacha Roux'],['13','Gabriel Fournier'],['14','Raphaël Girard']] },
  { id => 'test-sf1', cat => 'Sénior', sex => 'F', suf => '1', color => '#7C3AED', club => 'CLUB TEST PICKSTATS-1',
    players => [['4','Camille Dubois'],['5','Léa Fontaine'],['6','Manon Blanc'],['7','Chloé Faure'],['8','Jade Garnier'],
      ['9','Emma Bonnet'],['10','Lina Dupuis'],['11','Sarah Lambert'],['12','Inès Garcia'],['15','Zoé Chevalier']] },
  { id => 'test-u15m', cat => 'U15', sex => 'M', suf => '', color => '#DC2626', club => 'CLUB TEST PICKSTATS',
    players => [['4','Tom Rousseau'],['5','Enzo Vincent'],['6','Mathis Muller'],['7','Nolan Lefebvre'],['8','Maël Mercier'],
      ['9','Timéo Boyer'],['10','Axel Guerin'],['11','Sohan Morel'],['12','Liam Henry'],['14','Ilyes Roche']] },
  { id => 'test-u13f', cat => 'U13', sex => 'F', suf => '', color => '#F59E0B', club => 'CLUB TEST PICKSTATS',
    players => [['4','Alice Perrin'],['5','Rose Morin'],['6','Louise Mathieu'],['7','Anna Clément'],['8','Mila Gauthier'],
      ['9','Ambre Nicolas'],['10','Julia Robin'],['11','Nina Masson'],['12','Lou Sanchez']] },
);
for my $t (@TEAMS) {
  $t->{name} = join ' ', grep { length } $t->{cat}, $t->{sex}, $t->{suf};
  # Adresse au tir de chaque joueur : 2 ou 3 meneurs de jeu par équipe
  my $i = 0;
  $t->{skill} = { map { $_->[0] => ($i++ < 3 ? 2.2 - 0.4 * ($i - 1) : 0.5 + rand(0.8)) } @{ $t->{players} } };
}

my @OPPS = (
  ['BC des Pins', 'BC DES PINS-3', '#2563EB'], ['Saint-Médard', 'SAINT-MEDARD BASKET-2', '#DC2626'],
  ['Mérignac', 'MERIGNAC BASKET CLUB-1', '#7C3AED'], ['Pessac', 'ENTENTE PESSAC BASKET CLUB-3', '#0F172A'],
  ['Eysines', 'EYSINES BASKET-2', '#F59E0B'], ['Talence', 'TALENCE BASKET-1', '#16A34A'],
  ['Bègles', 'US BEGLES BASKET-2', '#DB2777'], ['Le Bouscat', 'LE BOUSCAT BASKET-1', '#0EA5E9'],
  ['Gradignan', 'GRADIGNAN BC-2', '#64748B'], ['Cenon', 'CENON BASKET-1', '#EA580C'],
);

# Scénario de chaque match : [équipe, adversaire, niveau (écart visé, + = on gagne), feuille, statut, particularité]
#   feuille : 'full' (résumé + feuille de marque), 'resume' (sans détail par quart-temps), '' (pas de feuille)
#   statut  : 'ok' (validé), 'pending' (publié par une bénévole, à valider), 'local' (sauvegardé, pas publié)
#   particularité : 'fouls' (le meilleur marqueur sort pour 5 fautes), 'ot' (prolongation), 'guest' (joueur hors équipe), 'absent'
my @PLAN = (
  ['test-sm1', 0,  -9, 'full', 'ok', ''],      ['test-sm1', 1,  12, 'full', 'ok', 'absent'],
  ['test-sm1', 2,   4, 'full', 'ok', 'fouls'], ['test-sm1', 3, -18, 'full', 'ok', ''],
  ['test-sm1', 4,   0, 'full', 'ok', 'ot'],    ['test-sm1', 5,  21, 'full', 'ok', 'guest'],
  ['test-sm1', 6,  -3, 'full', 'pending', ''], ['test-sm1', 7,   7, '', 'local', ''],
  ['test-sf1', 8,  15, 'full', 'ok', ''],      ['test-sf1', 9,  -6, 'full', 'ok', 'fouls'],
  ['test-sf1', 0,   8, 'resume', 'ok', ''],    ['test-sf1', 1,  -2, 'full', 'ok', 'absent'],
  ['test-sf1', 2,  10, '', 'ok', ''],          ['test-sf1', 3,   3, 'full', 'pending', ''],
  ['test-u15m', 4, 25, 'full', 'ok', ''],      ['test-u15m', 5, -11, 'full', 'ok', ''],
  ['test-u15m', 6,  5, '', 'ok', 'guest'],     ['test-u15m', 7, -4, 'full', 'ok', 'fouls'],
  ['test-u15m', 8,  9, '', 'local', ''],
  ['test-u13f', 9, 14, 'full', 'ok', ''],      ['test-u13f', 0, -7, '', 'ok', ''],
  ['test-u13f', 1,  2, '', 'ok', 'absent'],    ['test-u13f', 2, -1, 'full', 'pending', ''],
);

# Qui a saisi les stats (les pseudos des membres de test, voir README.md)
my %BY = (ok => ['Vincent', 'Karim', 'Julie', 'Sophie'], pending => ['Julie'], local => ['Vincent']);
my %AUTHOR = (Julie => 'test-julie', Vincent => 'test-vincent', Karim => 'test-karim', Sophie => 'test-sophie');

# --- Feuille e-Marque d'une équipe ---
# makes : [[p2, p3, lf] par période] pour l'équipe ; joueurs : [[n, poids], ...] ; renvoie les stats de la feuille.
sub sheet {
  my ($players, $per, $starters) = @_;   # $per : [{p2, p3, lf}] par période ; $players : [[n, poids, minutes]]
  my %qp; my %tot;
  for my $p (@$players) { $qp{$p->[0]} = [ map { { pts => 0, p2 => 0, p3 => 0, lf => 0 } } @$per ]; }
  my @w = map { $_->[1] } @$players;
  for my $qi (0 .. $#$per) {
    for my $k ('p2', 'p3', 'lf') {
      for (1 .. $per->[$qi]{$k}) {
        my $n = $players->[wpick(@w)][0];
        $qp{$n}[$qi]{$k}++;
      }
    }
  }
  my (%players, @q);
  my %T = (min => 0, pts => 0, fg => 0, p3 => 0, p2i => 0, p2e => 0, lf => 0, f => 0);
  for my $qi (0 .. $#$per) { push @q, 0 }
  for my $p (@$players) {
    my $n = $p->[0]; my %r = (p2 => 0, p3 => 0, lf => 0);
    for my $qi (0 .. $#$per) {
      my $x = $qp{$n}[$qi];
      $x->{pts} = 2 * $x->{p2} + 3 * $x->{p3} + $x->{lf};
      $r{$_} += $x->{$_} for qw(p2 p3 lf);
      $q[$qi] += $x->{pts};
    }
    my $p2e = $r{p2} ? (chance(0.25) ? 1 : 0) : 0;
    my $row = { min => mmss($p->[2]), pts => 2 * $r{p2} + 3 * $r{p3} + $r{lf}, fg => $r{p2} + $r{p3}, p3 => $r{p3},
      p2i => $r{p2} - $p2e, p2e => $p2e, lf => $r{lf}, f => 0 };
    $players{$n} = $row;
    $T{$_} += $row->{$_} for qw(pts fg p3 p2i p2e lf);
    $T{min} += $p->[2];
  }
  my $bench = 0;
  for my $p (@$players) { $bench += $players{$p->[0]}{pts} unless $starters->{$p->[0]} }
  return { players => \%players, qp => \%qp, q => \@q, total => \%T, bench => $bench };
}

# Fautes : réparties selon le temps de jeu, 5 au plus ; $out : joueur qui sort pour 5 fautes
sub fouls {
  my ($sh, $players, $n, $out) = @_;
  my @w = map { $_->[2] } @$players;
  my $given = 0;
  if ($out) { $sh->{players}{$out}{f} = 5; $given = 5 }
  while ($given < $n) {
    my $p = $players->[wpick(@w)][0];
    next if $sh->{players}{$p}{f} >= ($out && $p eq $out ? 5 : 4);
    $sh->{players}{$p}{f}++; $given++;
  }
  $sh->{total}{f} = $n;
}

# Temps de jeu : 5 titulaires plus longtemps ; total = 5 joueurs x durée du match
sub minutes {
  my ($ns, $len, $short) = @_;  # $short : joueur sorti tôt (5 fautes)
  my %w; my $i = 0;
  for my $n (@$ns) { $w{$n} = $i++ < 5 ? 3 + rand(1) : 0.8 + rand(0.9) }
  $w{$short} *= 0.6 if $short;
  my $sum = 0; $sum += $w{$_} for @$ns;
  my %m; my $left = 5 * $len;
  for my $n (@$ns) { $m{$n} = int(5 * $len * $w{$n} / $sum); $m{$n} = $len if $m{$n} > $len; $left -= $m{$n} }
  for my $n (@$ns) { last if $left <= 0; my $add = $len - $m{$n}; $add = $left if $add > $left; $m{$n} += $add; $left -= $add }
  return \%m;
}

# Paniers d'une période pour une équipe, autour de $pts points
sub period_makes {
  my ($pts) = @_;
  $pts = 4 if $pts < 4;
  my $p3 = rnd(4); $p3 = 0 if 3 * $p3 > $pts - 2;
  my $lf = rnd(6); $lf = 0 if $lf > $pts - 3 * $p3;
  my $rest = $pts - 3 * $p3 - $lf;
  if ($rest % 2) { $rest--; $lf++ }
  return { p2 => $rest / 2, p3 => $p3, lf => $lf };
}

# Actions saisies à la table pendant une période
sub period_events {
  my ($q, $ns, $mins, $makes_us) = @_;
  my @w = map { $mins->{$_} } @$ns;
  my @ev; my $who = sub { $ns->[wpick(@w)] };
  push @ev, { q => $q, a => 'm2', p => $who->() } for 1 .. $makes_us->{p2} + between(1, 4);
  push @ev, { q => $q, a => 'm3', p => $who->() } for 1 .. $makes_us->{p3} + between(1, 4);
  push @ev, { q => $q, a => 'm1', p => $who->() } for 1 .. rnd(4);
  push @ev, { q => $q, a => 'stl', p => $who->() } for 1 .. rnd(4);
  push @ev, { q => $q, a => 'fd', p => $who->() } for 1 .. between(1, 4);
  push @ev, { q => $q, a => 'to', p => $who->() } for 1 .. between(1, 5);
  push @ev, { q => $q, a => 'trav', p => $who->() } for 1 .. (chance(0.35) ? 1 : 0);
  push @ev, { q => $q, a => 'ro', p => '__team' } for 1 .. between(1, 5);
  push @ev, { q => $q, a => 'rd', p => '__team' } for 1 .. between(5, 11);
  push @ev, { q => $q, a => 'orb' } for 1 .. between(1, 5);
  push @ev, { q => $q, a => 'odr' } for 1 .. between(5, 10);
  push @ev, { q => $q, a => pick('w24', 'wr', 'wr', 'w8', 'w5'), p => '__team' } for 1 .. rnd(3);
  # ordre de saisie mélangé dans la période
  for (my $i = $#ev; $i > 0; $i--) { my $j = rnd($i + 1); @ev[$i, $j] = @ev[$j, $i] }
  return @ev;
}

# --- Matchs ---
my @arch; my %teamOf = map { $_->{id} => $_ } @TEAMS;
my %round;
my $id = 1757000000000;
for my $k (0 .. $#PLAN) {
  my ($tid, $oi, $gap, $feuille, $st, $special) = @{ $PLAN[$k] };
  my $t = $teamOf{$tid}; my $o = $OPPS[$oi];
  my $r = $round{$tid}++;
  # Un match par week-end, du 13 septembre au 8 novembre 2026 ; heure selon l'équipe
  my @days = ('2026-09-13','2026-09-20','2026-09-27','2026-10-04','2026-10-11','2026-10-18','2026-10-25','2026-11-01','2026-11-08');
  my %hour = ('test-sm1' => '18:30', 'test-sf1' => '16:00', 'test-u15m' => '14:00', 'test-u13f' => '11:00');
  my $date = $days[$r + (9 - scalar(grep { $_->[0] eq $tid } @PLAN))] . 'T' . $hour{$tid} . ':00.000Z';

  # Composition du match
  my @roster = map { { n => $_->[0], name => $_->[1], in => JSON::PP::true } } @{ $t->{players} };
  if ($special eq 'absent') { $roster[-2]{in} = JSON::PP::false }
  if ($special eq 'guest') { push @roster, { n => '21', name => ($t->{sex} eq 'F' ? 'Clara Invitée' : 'Léo Invité'), in => JSON::PP::true, nw => JSON::PP::true } }
  my @ns = map { $_->{n} } grep { $_->{in} } @roster;
  my %skill = (%{ $t->{skill} }, 21 => 0.9);

  # Score visé par période (les jeunes marquent moins)
  my $young = $t->{cat} =~ /^U1[35]/;
  my $base = $young ? 12 : 17;
  my (@us, @them);
  for my $q (1 .. 4) {
    my $u = $base + between(-2, 4) + int($gap / 8);
    my $v = $base + between(-2, 4) - int($gap / 8);
    push @us, $u; push @them, $v;
  }
  my $su = 0; $su += $_ for @us; my $sv = 0; $sv += $_ for @them;
  if ($special eq 'ot') { $them[3] += $su - $sv; $sv = $su }      # égalité à la fin du temps réglementaire
  elsif ($su == $sv) { $us[3] += 2 }
  my $periods = 4;
  if ($special eq 'ot') { push @us, between(8, 13); push @them, between(5, 10); $them[4]-- if $them[4] == $us[4]; $periods = 5 }
  my $len = 2400 + ($periods - 4) * 300;

  my $star = $ns[0];
  my $outer = $special eq 'fouls' ? $star : '';
  my $mins = minutes(\@ns, $len, $outer);
  my @usp = map { [$_, $mins->{$_} * ($skill{$_} // 1) / 600, $mins->{$_}] } @ns;
  my @per_us = map { period_makes($_) } @us;
  my %starters = map { $ns[$_] => 1 } 0 .. 4;
  my $shu = sheet(\@usp, \@per_us, \%starters);
  fouls($shu, \@usp, between(14, 24), $outer);

  # Adversaire : 9 à 11 joueurs, numéros entre 4 et 15
  my @on = sort { $a <=> $b } (sub { my %s; while (keys %s < $_[0]) { $s{between(4, 15)} = 1 } keys %s })->(between(9, 11));
  my $omins = minutes(\@on, $len);
  my @themp = map { [$_, $omins->{$_} * (0.5 + rand(1.5)) / 600, $omins->{$_}] } @on;
  my @per_them = map { period_makes($_) } @them;
  my %ostart = map { $on[$_] => 1 } 0 .. 4;
  my $sht = sheet(\@themp, \@per_them, \%ostart);
  fouls($sht, \@themp, between(14, 24), '');

  # Plus grand écart, série, égalités : d'après le score aux fins de période
  my ($cu, $cv, $advu, $advv) = (0, 0, 0, 0);
  for my $qi (0 .. $periods - 1) {
    $cu += $shu->{q}[$qi]; $cv += $sht->{q}[$qi];
    $advu = $cu - $cv if $cu - $cv > $advu; $advv = $cv - $cu if $cv - $cu > $advv;
  }
  $advu += between(0, 4) if $advu; $advv += between(0, 4) if $advv;

  my $home = chance(0.5);
  my $team_em = sub {
    my ($sh, $adv) = @_;
    my $h = [$sh->{q}[0] + $sh->{q}[1], $sh->{q}[2] + $sh->{q}[3]];
    my $x = { total => { %{ $sh->{total} }, min => mmss($sh->{total}{min}) }, halves => $h, ot => $periods - 4,
      players => $sh->{players}, adv => $adv, run => between(5, 13), bench => $sh->{bench} };
    if ($feuille eq 'full') { $x->{q} = $sh->{q}; $x->{qp} = $sh->{qp} }
    return $x;
  };
  my ($us_name, $op_name) = ($t->{club}, $o->[1]);
  my $em = { num => sprintf('%04d', between(1000, 9999)), a => $home ? $us_name : $op_name, b => $home ? $op_name : $us_name,
    side => $home ? 0 : 1, ties => rnd(4), us => $team_em->($shu, $advu), them => { name => $op_name, %{ $team_em->($sht, $advv) } } };

  my @ev; push @ev, period_events($_, \@ns, $mins, $per_us[$_ - 1]) for 1 .. $periods;

  my $by = pick(@{ $BY{$st} });
  my $m = { id => $id + $k * 1000, date => $date, me => $t->{name}, teamId => $tid, opp => $o->[0], oppColor => $o->[2],
    roster => \@roster, q => $periods, ev => \@ev, st => $st, by => $by };
  $m->{em} = $em if $feuille;
  $m->{author} = $AUTHOR{$by} if $st ne 'local';
  $m->{val} = pick('Vincent', 'Sophie') if $st eq 'ok';
  push @arch, $m;
}

# --- Sauvegarde ---
my @teams = map { my $t = $_; { id => $t->{id}, name => $t->{name}, cat => $t->{cat}, sex => $t->{sex}, suf => $t->{suf}, color => $t->{color},
  players => [ map { { id => $t->{id} . '-' . $_->[0], num => $_->[0], name => $_->[1] } } @{ $t->{players} } ] } } @TEAMS;
my $data = { active => JSON::PP::false, roster => [], ev => [], q => 1, me => 'Mon équipe', opp => 'Adversaire', teamId => undef,
  askReb => JSON::PP::true, clubName => 'Club Test Pick&Stats', teams => \@teams, arch => \@arch };
my $out = { app => 'stats-basket', version => 1, date => '2026-11-11T12:00:00.000Z', data => $data };

open my $fh, '>:encoding(UTF-8)', 'testdata/club-test.json' or die "testdata/club-test.json : $!";
print $fh JSON::PP->new->canonical->encode($out);
close $fh;
my %n; $n{$_->{st}}++ for @arch;
printf "testdata/club-test.json : %d équipes, %d matchs (%d validés, %d à valider, %d non publiés), %d avec feuille e-Marque\n",
  scalar @teams, scalar @arch, $n{ok} // 0, $n{pending} // 0, $n{local} // 0, scalar grep { $_->{em} } @arch;
