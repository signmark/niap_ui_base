{pkgs}: {
  deps = [
    pkgs.unixtools.netstat
    pkgs.lsof
    pkgs.ffmpeg
    pkgs.jq
    pkgs.postgresql
  ];
}
