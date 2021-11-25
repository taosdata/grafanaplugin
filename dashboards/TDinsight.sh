#!/usr/bin/env bash
set -e
verbose=0
[ -f .env ] && source .env

TDENGINE_PLUGIN_VERSION=${TDENGINE_PLUGIN_VERSION:-latest}
# Grafana configurations
GF_PROVISIONING_DIR=${GF_PROVISIONING_DIR:-/etc/grafana/provisioning/}
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
TDINSIGHT_DASHBOARD_EDITABLE=${TDINSIGHT_DASHBOARD_EDITABLE:-false}

SMS_ENABLED=${SMS_ENABLED:-false}
SMS_NOTIFIER_NAME=${SMS_NOTIFIER_NAME:-sms}
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

options=$(getopt -l "help,verbose,\
plugin-version:,\
grafana-provisioning-dir:,grafana-plugins-dir:,grafana-org-id:,\
tdengine-ds-name:,tdengine-api:,tdengine-user:,tdengine-password:,\
tdinsight-uid:,tdinsight-title:,tdinsight-editable,\
sms-enabled,sms-notifier-name:,\
sms-access-key-id:,sms-access-key-secret:,\
sms-sign-name:,sms-template-code:,sms-template-param:,sms-phone-numbers:,\
ms-listen-addr:" \
-o "hVv:P:G:O:n:a:u:p:i:t:esN:I:K:S:C:T:B:L:y" -a -- "$@")

usage() { # Function: Print a help message.
  cat << EOF
Usage: $0

Install and configure TDinsight dashboard in Grafana on ubuntu 18.04/20.04 system.

-h, -help,          --help                  Display help

-V, -verbose,       --verbose               Run script in verbose mode. Will print out each step of execution.

-v, --plugin-version <version>              TDengine datasource plugin version, [default: $TDENGINE_PLUGIN_VERSION]

-P, --grafana-provisioning-dir <dir>        Grafana provisioning directory, [default: $GF_PROVISIONING_DIR]
-G, --grafana-plugins-dir <dir>             Grafana plugins directory, [default: $GF_PLUGINS_DIR]
-O, --grafana-org-id <number>               Grafana orgnization id. [default: $GF_ORG_ID]

-n, --tdengine-ds-name <string>             TDengine datasource name, no space. [default: $TDENGINE_DS_NAME]
-a, --tdengine-api <url>                    TDengine REST API endpoint. [default: $TDENGINE_API]
-u, --tdengine-user <string>                TDengine user name. [default: $TDENGINE_USER]
-p, --tdengine-password <string>            TDengine password. [default: $TDENGINE_PASSWORD]

-i, --tdinsight-uid <string>                Replace with a non-space ascii code as the dashboard id. [default: $TDINSIGHT_DASHBOARD_UID]
-t, --tdinsight-title <string>              Dashboard title. [default: $TDINSIGHT_DASHBOARD_TITLE]
-e, --tdinsight-editable                    If the provisioning dashboard could be editable. [default: false]

Aliyun SMS as Notifier:
-s, --sms-enabled                           To enable tdengine-datasource plugin builtin aliyun sms webhook
-N, --sms-notifier-name <string>            [default: $SMS_NOTIFIER_NAME]
-I, --sms-access-key-id <string>            Aliyun sms access key id
-K, --sms-access-key-secret <string>        Aliyun sms access key secret
-S, --sms-sign-name <string>                Sign name
-C, --sms-template-code <string>            Template code
-T, --sms-template-param <string>           Template param, a escaped json string like "\\\\\"a\\\\\":\\\\\"hi\\\\\""
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
  -v | --plugin-version)
    shift
    export TDENGINE_PLUGIN_VERSION=$2
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
    export TDINSIGHT_DASHBOARD_EDITABLE=true
    ;;
  -s | --sms-enabled)
    export SMS_ENABLED=true
    ;;
  -N | --sms-notifier-name)
    export SMS_NOTIFIER_NAME=$1
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

_assert_dir() {
  [ -d "$1" ] || mkdir -p "$1"
}

get_latest_release() {
  curl --silent "https://api.github.com/repos/taosdata/grafanaplugin/releases/latest" | # Get latest release from GitHub api
    grep '"tag_name":' |                                                                # Get tag line
    sed -E 's/.*"v([^"]+)".*/\1/'                                                       # Pluck JSON value
}

get_dashboard_by_id() {
  echo "** Get dashboard json file by id $1 to $2"
  id=$1
  file=$2
  wget -qO $file https://grafana.com/api/dashboards/${id}/revisions/latest/download
}

install_plugin() {
  [ -s tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip ] || wget -c https://github.com/taosdata/grafanaplugin/releases/download/v$TDENGINE_PLUGIN_VERSION/tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip
  rm -rf /tmp/tdengine-datasource
  [ -d $GF_PLUGINS_DIR/tdengine-datasource ] && mv $GF_PLUGINS_DIR/tdengine-datasource /tmp/
  unzip -q tdengine-datasource-$TDENGINE_PLUGIN_VERSION.zip -d $GF_PLUGINS_DIR
  chmod +x $GF_PLUGINS_DIR/tdengine-datasource/tdengine-datasource*
}

allow_unsigned_plugin() {
  set +e
  grep -E "^allow_loading_unsigned_plugins.*tdengine-datasource" /etc/grafana/grafana.ini >/dev/null
  if [ "$?" != "0" ]; then
    tee -a /etc/grafana/grafana.ini <<EOF
[plugins]
allow_loading_unsigned_plugins = tdengine-datasource
EOF
  fi
  set -e
}

provisioning_datasource() {
  [ -d $GF_PROVISIONING_DATASOURCES_DIR ] || mkdir $GF_PROVISIONING_DATASOURCES_DIR
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
  # <bool> enable/disable basic auth
  basicAuth: true
#  withCredentials:
  # <bool> mark as default datasource. Max one per org
  isDefault: false
  # <map> fields that will be converted to json and stored in json_data
  jsonData:
    timeInterval: "30s"
    # <string> database user, if used
    user: $TDENGINE_USER
    # <string> database password, if used
    password: $TDENGINE_PASSWORD
    # Sms notification webhook support
    smsConfig:
      alibabaCloudSms:
        accessKeyId: $SMS_ACCESS_KEY_ID
        accessKeySecret: $SMS_ACCESS_KEY_SECRET
        signName: $SMS_SIGN_NAME
        templateCode: $SMS_TEMPLATE_CODE
        templateParam: "$SMS_TEMPLATE_PARAM"
      phoneNumbersList: "$SMS_PHONE_NUMBERS"
      listenAddr: ${SMS_LISTEN_ADDR}
  version: 1
  # <bool> allow users to edit datasources from the UI.
  editable: $TDINSIGHT_DASHBOARD_EDITABLE
EOF
}

provisioning_notifiers() {
  echo "Provisioning notifiers (notification channels)"
  _assert_dir $GF_PROVISIONING_NOTIFIERS_DIR

  cat > $GF_PROVISIONING_NOTIFIERS_DIR/${SMS_NOTIFIER_NAME}.yaml <<EOF
# config file version
apiVersion: 1

notifiers:
  - name: ${SMS_NOTIFIER_NAME}
    type: webhook
    uid: ${SMS_NOTIFIER_NAME}
    is_default: true
    settings:
      url: http://${SMS_LISTEN_ADDR}/sms
      httpMethod: POST
EOF
}

provisioning_dashboard() {
  echo "Provisioning dashboard $TDINSIGHT_DASHBOARD_ID"
  # 1. Download latest dashboard json file
  get_dashboard_by_id $TDINSIGHT_DASHBOARD_ID $TDINSIGHT_DASHBOARD_UID.json

  # 2. Replace with TDengine data source name
  sed 's#"datasource": "${DS_TDENGINE}"#"datasource": "'$TDENGINE_DS_NAME'"#g' -i $TDINSIGHT_DASHBOARD_UID.json
  sed 's/tdinsight/'$TDINSIGHT_DASHBOARD_UID'/' -i $TDINSIGHT_DASHBOARD_UID.json
  sed 's/TDinsight/'$TDINSIGHT_DASHBOARD_TITLE'/' -i $TDINSIGHT_DASHBOARD_UID.json
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
  mv $TDINSIGHT_DASHBOARD_UID.{json,yaml} $GF_PROVISIONING_DASHBOARDS_DIR
  echo "Provisioning dashboard $TDINSIGHT_DASHBOARD_ID done."
}

####################################
# main scripts
####################################
if [ "$TDENGINE_PLUGIN_VERSION" == "latest" ]; then
  TDENGINE_PLUGIN_VERSION=$(get_latest_release)
  echo using tdengine-datasource plugin $TDENGINE_PLUGIN_VERSION
fi

# Install tdengine-datasource plugin
install_plugin

# Config allow_loading_unsigned_plugins
allow_unsigned_plugin

# Provisioning TDengine data source
provisioning_datasource

# Provisioning TDengine notification channels
if [ "$SMS_ENABLED" == "true" ]; then
  provisioning_notifiers
fi

# Provisioning TDinsight dashboard
provisioning_dashboard
