import _ from 'lodash';

export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        this.scope = $scope;
        // console.log($scope, $injector, $q)
        this.backendSrv = $injector.get("backendSrv");
        this.pluginId = this.current.type;
        this.smsShowFlag = false;
        if (!_.has(this.current, "secureJsonData")) {
            this.current.secureJsonData = {};
        }
        if (!_.has(this.current.secureJsonData, "user")) {
            this.current.secureJsonData.user = "root";
        }
        if (!_.has(this.current.secureJsonData, "password")) {
            this.current.secureJsonData.password = "taosdata";
        }
        if (!_.has(this.current.secureJsonData, "token")) {
            this.current.secureJsonData.token = null;
        }
    }
    requestResources(url, params) {
        return this.backendSrv.datasourceRequest({
            url: `/api/plugins/${this.pluginId}/resources${url}`,
            data: params,
            method: 'POST',
        });
    }
    smsShowChange() {
        this.smsShowFlag = !this.smsShowFlag;
    }
}

GenericDatasourceConfigCtrl.templateUrl = 'partials/config.html';
