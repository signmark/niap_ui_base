{pkgs}: {
  deps = [
    pkgs.openssh
    pkgs.lsof
    pkgs.ffmpeg
    pkgs.jq
    pkgs.postgresql
  ];
}
