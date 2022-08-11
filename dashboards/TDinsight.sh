#!/usr/bin/env bash
BIN=$(realpath $(dirname $0))
set -e
verbose=0
REMOVE=0
OFFLINE=0
DOWNLOAD_ONLY=0
INSTALL_FROM_GRAFANA=0

[ -f .env ] && source .env

TDENGINE_PLUGIN_VERSION=${TDENGINE_PLUGIN_VERSION:-latest}
# Grafana configurations
GF_PROVISIONING_DIR=${GF_PROVISIONING_DIR:-/etc/grafana/provisioning}
GF_PLUGINS_DIR=${GF_PLUGINS_DIR:-/var/lib/grafana/plugins}

GF_PROVISIONING_DATASOURCES_DIR=${GF_PROVISIONING_DIR}/datasources
GF_PROVISIONING_DASHBOARDS_DIR=${GF_PROVISIONING_DIR}/dashboards
GF_PROVISIONING_NOTIFIERS_DIR=${GF_PROVISIONING_DIR}/notifiers
GF_ORG_ID=${GF_ORG_ID:-1}

# TDengine configurations
TDENGINE_DS_ENABLED=true
TDENGINE_DS_NAME=${TDENGINE_DS_NAME:-TDengine}
TDENGINE_API=${TDENGINE_API:-http://127.0.0.1:6041}
TDENGINE_USER=${TDENGINE_USER:-root}
TDENGINE_PASSWORD=${TDENGINE_PASSWORD:-taosdata}

LOG_REPLICA=${LOG_REPLICA:1}

# TDinsight dashboard configurations
TDINSIGHT_DASHBOARD_ID=15167
TDINSIGHT_DASHBOARD_UID=${TDINSIGHT_DASHBOARD_UID:-tdinsight}
TDINSIGHT_DASHBOARD_TITLE=${TDINSIGHT_DASHBOARD_TITLE:-TDinsight}
TDENGINE_EDITABLE=${TDENGINE_EDITABLE:-false}

EXTERNAL_NOTIFIER=

SMS_ENABLED=${SMS_ENABLED:-false}
SMS_NOTIFIER_NAME=${SMS_NOTIFIER_NAME:-TDinsight Builtin SMS}
SMS_NOTIFIER_IS_DEFAULT=${SMS_NOTIFIER_IS_DEFAULT:-false}
SMS_ACCESS_KEY_ID=${SMS_ACCESS_KEY_ID}
SMS_ACCESS_KEY_SECRET=${SMS_ACCESS_KEY_SECRET}
SMS_SIGN_NAME=${SMS_SIGN_NAME}
SMS_TEMPLATE_CODE=$SMS_TEMPLATE_CODE
SMS_TEMPLATE_PARAM=$SMS_TEMPLATE_PARAM
SMS_PHONE_NUMBERS=${SMS_PHONE_NUMBERS}
SMS_LISTEN_ADDR=${SMS_LISTEN_ADDR:-127.0.0.1:9100}

TDINSIGHT_NOTIFICATION_SMTP_ENABLED=false
TDINSIGHT_NOTIFICATION_SMTP_HOST=
TDINSIGHT_NOTIFICATION_SMTP_USER=
TDINSIGHT_NOTIFICATION_SMTP_PASSWORD=
TDINSIGHT_NOTIFICATION_SMTP_FROM_ADDRESS=
TDINSIGHT_NOTIFICATION_SMTP_FROM_NAME=

TDINSIGHT_NOTIFICATION_DINGING_ENABLED=false
TDINSIGHT_NOTIFICATION_DINGING_WEBHOOK=

TDINSIGHT_NOTIFICATION_ALERT_MANAGER_ENABLED=false
TDINSIGHT_NOTIFICATION_ALERT_MANAGER_URL=

options=$(getopt -l "help,verbose,remove,offline,download-only,\
plugin-version:,from-grafana,\
grafana-provisioning-dir:,grafana-plugins-dir:,grafana-org-id:,\
tdengine-ds-name:,tdengine-api:,tdengine-user:,tdengine-password:,tdengine-cloud-token:\
tdinsight-uid:,tdinsight-title:,tdinsight-editable,external-notifier:,\
sms-enabled,sms-notifier-name:,sms-notifier-uid:,sms-notifier-is-default,\
sms-access-key-id:,sms-access-key-secret:,\
sms-sign-name:,sms-template-code:,sms-template-param:,sms-phone-numbers:,\
ms-listen-addr:" \
-o "hVRFv:P:G:O:n:a:u:p:i:t:eE:sN:U:DI:K:S:C:T:B:L:y" -a -- "$@")

usage() { # Function: Print a help message.
  cat << EOF
Usage:
   $0
   $0 -h|--help
   $0 -n <ds-name> -a <api-url> -u <user> -p <password>

Install and configure TDinsight dashboard in Grafana on ubuntu 18.04/20.04 system.

-h, --help                                  Display help

-V, --verbose                               Run script in verbose mode. Will print out each step of execution.
-R, --remove                                Remove TDinsight dashboard, TDengine data source and the plugin.
-F, --offline                               Use file in local path (the directory this script located in or just cwd).
    --download-only                         Download plugin and dashboard json file into current directory.

-v, --plugin-version <version>              TDengine datasource plugin version, [default: $TDENGINE_PLUGIN_VERSION]

-P, --grafana-provisioning-dir <dir>        Grafana provisioning directory, [default: $GF_PROVISIONING_DIR]
-G, --grafana-plugins-dir <dir>             Grafana plugins directory, [default: $GF_PLUGINS_DIR]
-O, --grafana-org-id <number>               Grafana orgnization id. [default: $GF_ORG_ID]

-n, --tdengine-ds-name <string>             TDengine datasource name, no space. [default: $TDENGINE_DS_NAME]
-a, --tdengine-api <url>                    TDengine REST API endpoint. [default: $TDENGINE_API]
-u, --tdengine-user <string>                TDengine user name. [default: $TDENGINE_USER]
-p, --tdengine-password <string>            TDengine password. [default: $TDENGINE_PASSWORD]
    --tdengine-cloud-token <string>         TDengine cloud token. [env: \$TDENGINE_CLOUD_TOKEN]

-i, --tdinsight-uid <string>                Replace with a non-space ascii code as the dashboard id. [default: $TDINSIGHT_DASHBOARD_UID]
-t, --tdinsight-title <string>              Dashboard title. [default: $TDINSIGHT_DASHBOARD_TITLE]
-e, --tdinsight-editable                    If the provisioning dashboard could be editable. [default: false]

-E, --external-notifier <string>            Apply external notifier uid to TDinsight dashboard.

Aliyun SMS as Notifier:
-s, --sms-enabled                           To enable tdengine-datasource plugin builtin aliyun sms webhook.
-N, --sms-notifier-name <string>            Provisioning notifier name.[default: $SMS_NOTIFIER_NAME]
-U, --sms-notifier-uid <string>             Provisioning notifier uid, use lowercase notifier name by default.
-D, --sms-notifier-is-default               Set notifier as default.
-I, --sms-access-key-id <string>            Aliyun sms access key id
-K, --sms-access-key-secret <string>        Aliyun sms access key secret
-S, --sms-sign-name <string>                Sign name
-C, --sms-template-code <string>            Template code
-T, --sms-template-param <string>           Template params in json format like '{"alarm_level":"%s","time":"%s","name":"%s","content":"%s"}'
-B, --sms-phone-numbers <string>            Comma-separated numbers list, eg "189xxxxxxxx,132xxxxxxxx"
-L, --sms-listen-addr <string>              [default: $SMS_LISTEN_ADDR]
EOF
}

eval set -- "$options"

while true; do
  case $1 in
  -h | --help)
    usage
    exit 0
    ;;
  -V | --verbose)
    export verbose=1
    set -xv # Set xtrace and verbose mode.
    ;;
  -R | --remove)
    export REMOVE=1
    ;;
  -F | --offline)
    export OFFLINE=1
    ;;
  --download-only)
    export DOWNLOAD_ONLY=1
    ;;
  --from-grafana)
    export INSTALL_FROM_GRAFANA=1
    ;;
  -v | --plugin-version)
    shift
    export TDENGINE_PLUGIN_VERSION=$1
    ;;
  -P | --grafana-provisioning-dir)
    shift
    export GF_PROVISIONING_DIR=$1
    ;;
  -G | --grafana-plugins-dir)
    shift
    export GF_PLUGINS_DIR=$1
    ;;
  -O | --grafana-org-id)
    shift
    export GF_ORG_ID=$1
    ;;
  -n | --tdengine-ds-name)
    shift
    export TDENGINE_DS_NAME=$1
    ;;
  -a | --tdengine-api)
    shift
    export TDENGINE_API=$1
    ;;
  -u | --tdengine-user)
    shift
    export TDENGINE_USER=$1
    ;;
  -p | --tdengine-password)
    shift
    export TDENGINE_PASSWORD=$1
    ;;
  --tdengine-cloud-token)
    shift
    export TDENGINE_CLOUD_TOKEN=$1
    ;;
  -i | --tdinsight-uid)
    shift
    export TDINSIGHT_DASHBOARD_UID=$1
    ;;
  -t | --tdinsight-title)
    shift
    export TDINSIGHT_DASHBOARD_TITLE=$1
    ;;
  -e | --tdinsight-editable)
    shift
    export TDENGINE_EDITABLE=true
    ;;
  -E | --external-notifier)
    shift
    export EXTERNAL_NOTIFIER=$1
    ;;
  -s | --sms-enabled)
    export SMS_ENABLED=true
    ;;
  -N | --sms-notifier-name)
    shift
    export SMS_NOTIFIER_NAME=$1
    ;;
  -U | --sms-notifier-uid)
    shift
    export SMS_NOTIFIER_UID=$1
    ;;
  -D | --sms-notifier-is-default)
    export SMS_NOTIFIER_IS_DEFAULT=true
    ;;
  -I | --sms-access-key-id)
    shift
    export SMS_ACCESS_KEY_ID=$1
    ;;
  -K | --sms-access-key-secret)
    shift
    export SMS_ACCESS_KEY_SECRET=$1
    ;;
  -S | --sms-sign-name)
    shift
    export SMS_SIGN_NAME=$1
    ;;
  -C | --sms-template-code)
    shift
    export SMS_TEMPLATE_CODE=$1
    ;;
  -T | --sms-template-param)
    shift
    export SMS_TEMPLATE_PARAM=$1
    ;;
  -B | --sms-phone-numbers)
    shift
    export SMS_PHONE_NUMBERS=$1
    ;;
  -L | --sms-listen-addr)
    shift
    export SMS_LISTEN_ADDR=$1
    ;;
  --)
    shift
    break
    ;;
  esac
  shift
done

if [ "$SMS_NOTIFIER_UID" == "" ]; then
  SMS_NOTIFIER_UID=$(echo $SMS_NOTIFIER_NAME | tr 'A-Z' 'a-z' | tr ' ' '-')
fi

if [ "$EXTERNAL_NOTIFIER" != "" ]; then
  echo "TDinsight builtin sms is disabled by external notifier settings."
  export SMS_ENABLED=false
fi

_assert_dir() {
  [ -d "$1" ] || mkdir -p "$1"
}

get_latest_release() {
  curl --silent "https://api.github.com/repos/taosdata/grafanaplugin/releases/latest" | # Get latest release from GitHub api
    grep '"tag_name":' |                                                                # Get tag line
    sed -E 's/.*"v([^"]+)".*/\1/'                                                       # Pluck JSON value
}

get_dashboard_by_id() {
  [ "$verbose" = "0" ] || echo "** Get dashboard json file by id $1 to $2"
  id=$1
  file=$2
  wget -qO $file https://grafana.com/api/dashboards/${id}/revisions/latest/download
}

download_plugin() {
  [ "$verbose" = "0" ] || echo "** download plugin version $TDENGINE_PLUGIN_VERSION"
  [ -s tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip ] || \
    wget -c https://github.com/taosdata/grafanaplugin/releases/download/v$TDENGINE_PLUGIN_VERSION/tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip
  
}

install_plugin() {
  which grafana-cli > /dev/null || (echo "Grafana has not been installed in the server, install it first."; exit 1)
  if [ "$OFFLINE" = 0 ]; then
    download_plugin
  else
    [ -s tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip ] || (echo "use offline cache, but plugin not exist"; exit 1)
  fi
  # open a simple server for local url
  port=$(shuf -i 2000-65000 -n 1)

  if [ "$(command -v python3)" = "" ]; then
    if [ "$(command -v python2)" = "" ]; then
      echo "Grafana plugin installation requires python2 or python3, please install one first!"; exit 1
    fi
    python2 -m SimpleHTTPServer $port &
    pid=$!
  else
    python3 -m http.server $port &
    pid=$!
  fi
  sleep 1
  set +e
  grafana-cli --pluginUrl http://localhost:$port/tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip plugins install tdengine-datasource
  status=$?
  kill $pid
  set -e
  if [ "$status" != "0" ]; then
    exit $status
  fi
}

allow_unsigned_plugin() {
  [ -f /etc/grafana/grafana.ini ] || (echo "seems Grafana is not installed, please check"; exit 1)
  set +e
  grep -E "^allow_loading_unsigned_plugins.*tdengine-datasource" /etc/grafana/grafana.ini >/dev/null
  if [ "$?" != "0" ]; then
    echo "* Configuring /etc/grafana/grafana.ini"
    tee -a /etc/grafana/grafana.ini > /dev/null <<EOF
[plugins]
allow_loading_unsigned_plugins = tdengine-datasource
EOF
  fi
  set -e
}

remove_plugin() {
  set +e
  sed -i "s/tdengine-datasource//g" /etc/grafana/grafana.ini
  rm -rf $GF_PLUGINS_DIR/tdengine-datasource
  set -e
}

provisioning_datasource() {
  [ -d $GF_PROVISIONING_DATASOURCES_DIR ] || mkdir $GF_PROVISIONING_DATASOURCES_DIR
  echo "* Provisioning $GF_PROVISIONING_DATASOURCES_DIR/$TDENGINE_DS_NAME.yaml"
  TDENGINE_BASIC_AUTH=$(printf "$TDENGINE_USER:$TDENGINE_PASSWORD" | base64)
  cat > $GF_PROVISIONING_DATASOURCES_DIR/$TDENGINE_DS_NAME.yaml <<EOF
# config file version
apiVersion: 1

# list of datasources to insert/update depending
# whats available in the database
datasources:
  # <string, required> name of the datasource. Required
- name: $TDENGINE_DS_NAME
  # <string, required> datasource type. Required
  type: tdengine-datasource
  # <string, required> access mode. direct or proxy. Required
  # <int> org id. will defauto orgId 1 if not specified
  orgId: $GF_ORG_ID
  # <string> url
  url: $TDENGINE_API
  # <map> fields that will be converted to json and stored in json_data
  secureJsonData:
    url: $TDENGINE_API
    basicAuth: $TDENGINE_BASIC_AUTH
    # <string> cloud service token of TDengine,  optional.
    token: $TDENGINE_CLOUD_TOKEN

    # aliSms* is configuration options for builtin sms notifier powered by Aliyun Cloud SMS

    # <string> the key id from Aliyun.
    aliSmsAccessKeyId: "$SMS_ACCESS_KEY_ID"
    # <string> key secret paired to key id.
    aliSmsAccessKeySecret: "$SMS_ACCESS_KEY_SECRET"
    aliSmsSignName: "$SMS_SIGN_NAME"
    # <string> sms template code from Aliyun. eg. SMS_123010240
    aliSmsTemplateCode: "$SMS_TEMPLATE_CODE"
    # <string> serialized json string for sms template parameters. eg.
    #  '{"alarm_level":"%s","time":"%s","name":"%s","content":"%s"}'
    aliSmsTemplateParam: '$SMS_TEMPLATE_PARAM'
    # <string> phone number list, separated by comma ,
    aliSmsPhoneNumbersList: "$SMS_PHONE_NUMBERS"
    # <string> builtin sms notifier webhook address.
    aliSmsListenAddr: "$SMS_LISTEN_ADDR"
  version: 1
  # <bool> allow users to edit datasources from the UI.
  editable: $TDENGINE_EDITABLE
EOF
}

remove_datasource() {
  rm $GF_PROVISIONING_DATASOURCES_DIR/$TDENGINE_DS_NAME.yaml
}

provisioning_notifiers() {
  if [ "$SMS_ENABLED" == "true" ]; then
    _assert_dir $GF_PROVISIONING_NOTIFIERS_DIR
    echo "* Provisioning $GF_PROVISIONING_NOTIFIERS_DIR/${SMS_NOTIFIER_UID}.yaml"
    tee $GF_PROVISIONING_NOTIFIERS_DIR/${SMS_NOTIFIER_UID}.yaml > /dev/null <<EOF
# config file version
apiVersion: 1

notifiers:
  - name: ${SMS_NOTIFIER_NAME}
    type: webhook
    uid: ${SMS_NOTIFIER_UID}
    is_default: ${SMS_NOTIFIER_IS_DEFAULT}
    settings:
      url: http://${SMS_LISTEN_ADDR}/sms
      httpMethod: POST
EOF
  fi
}

remove_notifier() {
  set +e
  [ -e "$GF_PROVISIONING_NOTIFIERS_DIR/${SMS_NOTIFIER_UID}.yaml" ] && rm "$GF_PROVISIONING_NOTIFIERS_DIR/${SMS_NOTIFIER_UID}.yaml"
  set -e
}

download_dashboard() {
  #get_dashboard_by_id $TDINSIGHT_DASHBOARD_ID TDinsight-$TDINSIGHT_DASHBOARD_ID.json
  wget -c https://github.com/taosdata/grafanaplugin/releases/latest/TDinsight.json TDinsight-$TDINSIGHT_DASHBOARD_ID.json
}

provisioning_dashboard() {
  echo "* Provisioning dashboard $TDINSIGHT_DASHBOARD_ID as $TDINSIGHT_DASHBOARD_UID"
  # 1. Download latest dashboard json file or use cached file
  if [ "$OFFLINE" = "0" ]; then
    get_dashboard_by_id $TDINSIGHT_DASHBOARD_ID $TDINSIGHT_DASHBOARD_UID.json
  else
    if [ -e "TDinsight-$TDINSIGHT_DASHBOARD_ID.json" ]; then
      cp "TDinsight-$TDINSIGHT_DASHBOARD_ID.json" $TDINSIGHT_DASHBOARD_UID.json
    elif [ -e "$BIN/TDinsight-$TDINSIGHT_DASHBOARD_ID.json" ]; then
      cp "$BIN/TDinsight-$TDINSIGHT_DASHBOARD_ID.json" $TDINSIGHT_DASHBOARD_UID.json
    else
      echo "** in offline mode bug no cached files there"
      exit 1
    fi
  fi

  if [ "$EXTERNAL_NOTIFIER" != "" ]; then
    sed 's/tdinsight-builtin-sms/'$EXTERNAL_NOTIFIER'/' -i $TDINSIGHT_DASHBOARD_UID.json
  else
    if [ "$SMS_ENABLED" == "true" ] && [ "$SMS_NOTIFIER_IS_DEFAULT" == "false" ]; then
      sed 's/tdinsight-builtin-sms/'$SMS_NOTIFIER_UID'/' -i $TDINSIGHT_DASHBOARD_UID.json
    else
      #sed -E 's/^.*uid.*tdinsight-builtin-sms.*$//' -i $TDINSIGHT_DASHBOARD_UID.json
      sed -E 's/"tdinsight-builtin-sms"/"__fake__"/' -i $TDINSIGHT_DASHBOARD_UID.json
    fi
  fi
  # 2. Replace with TDengine data source name
  sed 's#"datasource": "${DS_TDENGINE}"#"datasource": "'$TDENGINE_DS_NAME'"#g' -i $TDINSIGHT_DASHBOARD_UID.json
  sed 's/"tdinsight"/"'$TDINSIGHT_DASHBOARD_UID'"/' -i $TDINSIGHT_DASHBOARD_UID.json
  sed 's/"TDinsight"/"'"$TDINSIGHT_DASHBOARD_TITLE"'"/' -i $TDINSIGHT_DASHBOARD_UID.json
  sed 's/"gnetId": 15167/"gnetId": null/' -i $TDINSIGHT_DASHBOARD_UID.json


  # 4. Add dashboard config
  cat > $TDINSIGHT_DASHBOARD_UID.yaml <<EOF
apiVersion: 1
providers:
  - name: ${TDINSIGHT_DASHBOARD_UID}
    type: file
    updateIntervalSeconds: 60
    options:
      path: /etc/grafana/provisioning/dashboards/$TDINSIGHT_DASHBOARD_UID.json
EOF

  # 3. Add this to provisioning directory
  [ -d $GF_PROVISIONING_DASHBOARDS_DIR ] || mkdir -p $GF_PROVISIONING_DASHBOARDS_DIR
  echo "** Provisioning $GF_PROVISIONING_DASHBOARDS_DIR/$TDINSIGHT_DASHBOARD_UID.{json,yaml}"
  mv $TDINSIGHT_DASHBOARD_UID.{json,yaml} $GF_PROVISIONING_DASHBOARDS_DIR
  echo "** Provisioning done."
}

remove_dashboard() {
  set +e
  rm $GF_PROVISIONING_DASHBOARDS_DIR/$TDINSIGHT_DASHBOARD_UID.{json,yaml}
  set -e
}

if [ "$REMOVE" == "1" ]; then
  remove_dashboard
  remove_notifier
  remove_datasource
  remove_plugin
  exit 0
fi

####################################
# main scripts
####################################
if [ "$DOWNLOAD_ONLY" = "1" ]; then
  if [ "$TDENGINE_PLUGIN_VERSION" = "latest" ]; then
    TDENGINE_PLUGIN_VERSION=$(get_latest_release)
  fi
  download_plugin
  download_dashboard
  echo "TDENGINE_PLUGIN_VERSION=$TDENGINE_PLUGIN_VERSION" > .tdinsight.cache

  echo .tdinsight.cache
  echo TDinsight-$TDINSIGHT_DASHBOARD_ID.json
  echo tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip
  exit 0
fi

# Install tdengine-datasource plugin
if [ "$INSTALL_FROM_GRAFANA" = "1" ]; then
  install_plugin_from_grafana
else

  if [ "$OFFLINE" = "1" ]; then
    [ -e "$BIN/.tdinsight.cache" ] && source $BIN/.tdinsight.cache
    [ -e ".tdinsight.cache" ] && source .tdinsight.cache
  fi

  if [ "$TDENGINE_PLUGIN_VERSION" = "latest" ]; then
    TDENGINE_PLUGIN_VERSION=$(get_latest_release)
    echo using tdengine-datasource plugin $TDENGINE_PLUGIN_VERSION
  fi

  install_plugin

fi


# Config allow_loading_unsigned_plugins
allow_unsigned_plugin

# Provisioning TDengine data source
provisioning_datasource

# Provisioning TDengine notification channels
provisioning_notifiers

# Provisioning TDinsight dashboard
provisioning_dashboard
