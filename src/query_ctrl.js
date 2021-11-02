import { QueryCtrl } from 'app/plugins/sdk';
import './css/query-editor.css!'

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  constructor($scope, $injector) {
    super($scope, $injector);
    this.scope = $scope;

    this.queryTypes = ["SQL", "Arithmetic"];
    this.formatTypes = ["Time series", "Table"];
    this.target.queryType = this.target.queryType || this.queryTypes[0];
    this.target.formatType = this.target.formatType || this.formatTypes[0];
    this.target.colNameToGroup = this.target.colNameToGroup || "";
    this.target.colNameFormatStr = this.target.colNameFormatStr || "";
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }

  targetBlur() {
    this.panelCtrl.refresh();
  }

  generateSQL() {
    this.lastGenerateSQL = this.datasource.generateSqlList[this.target.refId];
    this.showGenerateSQL = !this.showGenerateSQL;
  }

  validateArithmeticQuery(target, errs) {
    if (!target.expression || target.expression.length == 0) {
      errs.expression = "Must specify a javascript expression";
      return false;
    }
    return true;
  }

}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';