import _ from 'lodash';

export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        this.scope = $scope;
        // console.log($scope, $injector, $q)
        this.backendSrv = $injector.get("backendSrv");
        this.pluginId = this.current.type;
        this.smsShowFlag = false;
        if (!_.has(this.current, "jsonData")) {
            this.current.jsonData = {};
        }
        if (!_.has(this.current.jsonData, "user")) {
            this.current.jsonData.user = "root";
        }
        if (!_.has(this.current.jsonData, "password")) {
            this.current.jsonData.password = "taosdata";
        }
        if (!_.has(this.current.jsonData, "token")) {
            this.current.jsonData.token = null;
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
